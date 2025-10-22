#!/usr/bin/env pwsh
# Build script for Orca WASM module
# Works on Windows, macOS, and Linux
param(
    [switch]$Clean,
    [switch]$Debug,
    [string]$Jobs = "4",
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Orca WASM Build Script

Usage: ./build.ps1 [options]

Options:
    -Clean      Clean build directory before building
    -Debug      Build with debug information
    -Jobs N     Number of parallel build jobs (default: 4)
    -Help       Show this help message

Make sure to run './setup.ps1' first to prepare the build environment.
"@
    exit 0
}

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }

Write-Info "Building Orca WASM module..."

# Check if we're in the right directory
if (!(Test-Path "wasm/CMakeLists.txt")) {
    Write-Error "Please run this script from the orca-wasm-mvp root directory"
    exit 1
}

# Check if setup has been run
if (!(Test-Path "orca/.git")) {
    Write-Error "OrcaSlicer submodule not initialized. Run './setup.ps1' first."
    exit 1
}

# Setup Emscripten environment
Write-Info "Setting up Emscripten environment..."
$emsdkPath = Join-Path $PWD "emsdk"

if (Test-Path $emsdkPath) {
    Push-Location $emsdkPath
    try {
        if ($IsWindows -or $env:OS -eq "Windows_NT") {
            cmd /c "emsdk_env.bat"
            # Set environment variables for this PowerShell session
            $env:EMSDK = $emsdkPath
            $env:PATH = "$emsdkPath;$emsdkPath\upstream\emscripten;$env:PATH"
        } else {
            . "./emsdk_env.sh"
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Error "Emscripten SDK not found. Run './setup.ps1' first."
    exit 1
}

# Verify Emscripten is available
$emccPath = $null
if ($IsWindows -or $env:OS -eq "Windows_NT") {
    $emccPath = "$emsdkPath\upstream\emscripten\emcc.bat"
    if (!(Test-Path $emccPath)) {
        $emccPath = Get-Command emcc.bat -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    }
} else {
    $emccPath = Get-Command emcc -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
}

if (!$emccPath) {
    Write-Error "emcc not found. Please ensure Emscripten is properly installed and activated."
    exit 1
}

Write-Success "Emscripten found at: $emccPath"

# Clean build directory if requested
if ($Clean -and (Test-Path "build-wasm")) {
    Write-Info "Cleaning build directory..."
    Remove-Item -Recurse -Force "build-wasm"
}

# Set build type
$buildType = if ($Debug) { "Debug" } else { "Release" }

# Configure with CMake
Write-Info "Configuring build with CMake..."
$cmakeArgs = @(
    "-S", "wasm"
    "-B", "build-wasm"
    "-DCMAKE_BUILD_TYPE=$buildType"
    "-DCMAKE_DISABLE_FIND_PACKAGE_TBB=TRUE"
    "-DCMAKE_TOOLCHAIN_FILE=$emsdkPath/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake"
)

# Try to use emcmake if available, otherwise use regular cmake with toolchain
$emcmakePath = $null
if ($IsWindows -or $env:OS -eq "Windows_NT") {
    $emcmakePath = "$emsdkPath\upstream\emscripten\emcmake.bat"
} else {
    $emcmakePath = "$emsdkPath/upstream/emscripten/emcmake"
}

try {
    if (Test-Path $emcmakePath) {
        Write-Info "Using emcmake for configuration..."
        & $emcmakePath cmake @cmakeArgs
    } else {
        Write-Info "Using cmake with Emscripten toolchain..."
        cmake @cmakeArgs
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Error "CMake configuration failed"
        exit 1
    }
    Write-Success "CMake configuration complete"
} catch {
    Write-Error "Failed to configure build: $_"
    exit 1
}

# Build
Write-Info "Building WASM module (using $Jobs parallel jobs)..."
try {
    cmake --build build-wasm --config $buildType -j $Jobs
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed"

        # Try to show useful error information
        $logFile = "build-wasm/CMakeFiles/CMakeError.log"
        if (Test-Path $logFile) {
            Write-Info "Recent CMake errors:"
            Get-Content $logFile -Tail 20 | ForEach-Object { Write-Host "  $_" }
        }
        exit 1
    }
    Write-Success "Build complete"
} catch {
    Write-Error "Build failed: $_"
    exit 1
}

# Stage artifacts
Write-Info "Staging artifacts for web app..."
$webWasmDir = "web/public/wasm"
if (!(Test-Path $webWasmDir)) {
    New-Item -ItemType Directory -Path $webWasmDir -Force | Out-Null
}

$wasmFiles = @("slicer.js", "slicer.wasm")
$allFilesExist = $true

foreach ($file in $wasmFiles) {
    $sourcePath = "build-wasm/$file"
    $destPath = "$webWasmDir/$file"

    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath $destPath -Force
        Write-Success "Copied $file"
    } else {
        Write-Error "Missing build artifact: $sourcePath"
        $allFilesExist = $false
    }
}

if ($allFilesExist) {
    Write-Success "🎉 WASM build complete!"
    Write-Info @"

Build artifacts available at:
- web/public/wasm/slicer.js
- web/public/wasm/slicer.wasm

You can now serve the web application or use these files in your web worker.
"@
} else {
    Write-Error "Build completed but some artifacts are missing. Check the build output above."
    exit 1
}
