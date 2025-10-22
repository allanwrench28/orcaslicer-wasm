#!/usr/bin/env pwsh
# Setup script for Orca WASM build environment
# Works on Windows, macOS, and Linux
param(
    [switch]$SkipDeps,
    [switch]$CleanBuild,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Orca WASM Setup Script

Usage: ./setup.ps1 [options]

Options:
    -SkipDeps     Skip dependency building (Boost, Math libraries)
    -CleanBuild   Clean previous build artifacts
    -Help         Show this help message

This script will:
1. Install/setup Emscripten SDK if needed
2. Initialize the OrcaSlicer submodule
3. Build required dependencies (Boost, GMP, MPFR, CGAL)
4. Apply WASM patches
5. Configure the build environment

After running this script, use 'build.ps1' to compile the WASM module.
"@
    exit 0
}

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors for output
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }

Write-Info "Starting Orca WASM setup..."

# Check if we're in the right directory
if (!(Test-Path "wasm/CMakeLists.txt")) {
    Write-Error "Please run this script from the orca-wasm-mvp root directory"
    exit 1
}

# 1. Setup Emscripten SDK (idempotent)
Write-Info "Setting up Emscripten SDK..."

# Prefer a pre-installed EMSDK if available
$emsdkPath = $null
if ($env:EMSDK -and (Test-Path $env:EMSDK)) {
    $emsdkPath = (Resolve-Path $env:EMSDK).Path
}

if (-not $emsdkPath) {
    # Try to infer from emcc on PATH
    $emccCmd = (Get-Command emcc.bat -ErrorAction SilentlyContinue) ?? (Get-Command emcc -ErrorAction SilentlyContinue)
    if ($emccCmd) {
        $emccDir = Split-Path -Parent $emccCmd.Source
        # emcc is typically at <EMSDK>/upstream/emscripten
        $maybeRoot = (Resolve-Path (Join-Path $emccDir "..\..")).Path
        if (Test-Path (Join-Path $maybeRoot "emsdk_env.bat") -or Test-Path (Join-Path $maybeRoot "emsdk_env.sh")) {
            $emsdkPath = $maybeRoot
        }
    }
}

if (-not $emsdkPath) {
    # Fallback to repo-local emsdk folder
    $emsdkPath = (Join-Path $PWD "emsdk")
}

if (!(Test-Path $emsdkPath)) {
    Write-Info "Cloning Emscripten SDK to $emsdkPath ..."
    git clone https://github.com/emscripten-core/emsdk.git $emsdkPath
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to clone Emscripten SDK"
        exit 1
    }
}

# Install/activate only if emcc not available from this emsdk
$needInstall = $true
if (Test-Path (Join-Path $emsdkPath "upstream/emscripten/emcc.bat")) { $needInstall = $false }
if (Test-Path (Join-Path $emsdkPath "upstream/emscripten/emcc")) { $needInstall = $false }

Push-Location $emsdkPath
try {
    if ($needInstall) {
        if ($IsWindows -or $env:OS -eq "Windows_NT") {
            & ".\emsdk.bat" install latest
            & ".\emsdk.bat" activate latest
        } else {
            & "./emsdk" install latest
            & "./emsdk" activate latest
        }

        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install/activate Emscripten"
            exit 1
        }
        Write-Success "Emscripten SDK installed/activated"
    } else {
        Write-Info "Emscripten SDK already installed, skipping install"
        # Ensure PATH is set for current session on Windows
        if ($IsWindows -or $env:OS -eq "Windows_NT") {
            $env:EMSDK = $emsdkPath
            $env:PATH = "$emsdkPath;$emsdkPath\upstream\emscripten;" + $env:PATH
        }
    }
} finally {
    Pop-Location
}

# 2. Initialize OrcaSlicer submodule (robust, shallow, tracks main)
Write-Info "Initializing OrcaSlicer submodule..."

# Ensure .gitmodules has the right settings
git config -f .gitmodules submodule.orca.url https://github.com/SoftFever/OrcaSlicer.git | Out-Null
git config -f .gitmodules submodule.orca.branch main | Out-Null
git config -f .gitmodules submodule.orca.shallow true | Out-Null

# Try updating submodule to remote tracked branch with shallow clone
git submodule update --init --depth 1 --remote --progress -- orca

if ($LASTEXITCODE -ne 0) {
    Write-Warning "Standard submodule update failed. Attempting to re-add submodule..."

    # Clean any partial state
    git submodule deinit -f -- orca 2>$null | Out-Null
    if (Test-Path ".git/modules/orca") { Remove-Item -Recurse -Force ".git/modules/orca" }
    if (Test-Path "orca") { Remove-Item -Recurse -Force "orca" }

    # Re-add with branch pin and shallow
    git submodule add -f -b main https://github.com/SoftFever/OrcaSlicer.git orca
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to add OrcaSlicer submodule"
        exit 1
    }
    git submodule update --init --depth 1 --progress -- orca
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to initialize OrcaSlicer submodule after re-adding"
        exit 1
    }
}

Write-Success "OrcaSlicer submodule ready"

# 3. Create proper environment configuration (portable POSIX shell)
Write-Info "Creating environment configuration..."
$envContent = @'
# Emscripten environment configuration
# Auto-generated by setup.ps1 (portable bash)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Prefer environment EMSDK if set, else repo-local emsdk
EMSDK_PATH="${EMSDK:-$REPO_DIR/emsdk}"

# Convert Windows path to Unix when under MSYS/Cygwin
if command -v cygpath >/dev/null 2>&1; then
    EMSDK_PATH="$(cygpath -u "$EMSDK_PATH")"
fi

if [ -f "$EMSDK_PATH/emsdk_env.sh" ]; then
    # shellcheck disable=SC1090
    source "$EMSDK_PATH/emsdk_env.sh"
elif [ -f "/opt/emsdk/emsdk_env.sh" ]; then
    # shellcheck disable=SC1091
    source "/opt/emsdk/emsdk_env.sh"
else
    echo "Warning: Emscripten environment not found"
fi
'@

Set-Content -Path "wasm/toolchain/emsdk.env" -Value $envContent -NoNewline
Write-Success "Environment configuration created"

# 4. Build dependencies (if not skipped)
if (!$SkipDeps) {
    Write-Info "Building dependencies..."

    # Check if we need to build Boost
    $boostInstallPath = "deps/boost-wasm/install"
    if (!(Test-Path $boostInstallPath) -or $CleanBuild) {
        Write-Info "Building Boost for WASM (this will take a while)..."

        # We'll create a simplified Boost build process
        Write-Warning "Boost build may require additional setup - see README for manual steps if this fails"
        try {
            if ($IsWindows -or $env:OS -eq "Windows_NT") {
                # On Windows, we might need to use different approach
                Write-Info "For Windows, you may need to build Boost manually or use pre-built libraries"
                Write-Info "Skipping Boost build for now - check build output for missing dependencies"
            } else {
                bash deps/boost-wasm/build_boost.sh
            }
        } catch {
            Write-Warning "Boost build failed - continuing anyway. You may need to build it manually."
        }
    }

    # Check if we need to build math libraries
    $mathInstallPath = "deps/toolchain-wasm/install"
    if (!(Test-Path $mathInstallPath) -or $CleanBuild) {
        Write-Info "Building math libraries (GMP, MPFR, CGAL)..."
        try {
            if ($IsWindows -or $env:OS -eq "Windows_NT") {
                Write-Info "Math libraries build may require WSL or Linux environment"
                Write-Info "Skipping math build for now - check build output for missing dependencies"
            } else {
                bash deps/toolchain-wasm/build_math.sh
            }
        } catch {
            Write-Warning "Math libraries build failed - continuing anyway. You may need to build them manually."
        }
    }
} else {
    Write-Info "Skipping dependency builds (--SkipDeps specified)"
}

# 5. Apply WASM patches
Write-Info "Applying WASM patches to OrcaSlicer..."
$patchFile = "patches/orca-wasm.patch"
if (Test-Path $patchFile) {
    Push-Location "orca"
    try {
        # Check if patch is already applied
        git apply --reverse --check "../$patchFile" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Info "WASM patch already applied"
        } else {
            # Try to apply patch
            git apply --check "../$patchFile" 2>$null
            if ($LASTEXITCODE -eq 0) {
                git apply "../$patchFile"
                Write-Success "Applied WASM patch"
            } else {
                Write-Warning "WASM patch did not apply cleanly - you may need to apply it manually"
            }
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Warning "WASM patch file not found: $patchFile"
}

# 6. Clean build directory if requested
if ($CleanBuild -and (Test-Path "build-wasm")) {
    Write-Info "Cleaning previous build..."
    Remove-Item -Recurse -Force "build-wasm"
    Write-Success "Build directory cleaned"
}

Write-Success "Setup complete! 🎉"
Write-Info @"

Next steps:
1. Run './build.ps1' to compile the WASM module
2. If you encounter missing dependencies, see README.md for manual setup
3. For Windows users, some dependencies may need WSL or manual building

Environment ready for WASM development!
"@
