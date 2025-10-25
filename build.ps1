#!/usr/bin/env pwsh
# Build script for Orca WASM module
# Works on Windows, macOS, and Linux
param(
    [switch]$Clean,
    [switch]$Debug,
    [string]$Jobs = "4",
    [switch]$StageCGALHeaders,
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

if (!(Test-Path $emsdkPath) -and $env:EMSDK) {
    try {
        $resolved = Resolve-Path $env:EMSDK -ErrorAction Stop
        $emsdkPath = $resolved.Path
        Write-Info "Using EMSDK from environment: $emsdkPath"
    } catch {
        Write-Warning "EMSDK environment variable points to '$($env:EMSDK)', but the path is unavailable. Falling back to repo-local emsdk folder."
    }
}

if (Test-Path $emsdkPath) {
    Push-Location $emsdkPath
    try {
        if ($IsWindows -or $env:OS -eq "Windows_NT") {
            $envScriptPs1 = Join-Path $emsdkPath "emsdk_env.ps1"
            $envScriptBat = Join-Path $emsdkPath "emsdk_env.bat"

            if (Test-Path $envScriptPs1) {
                Write-Info "Importing Emscripten environment (emsdk_env.ps1)..."
                . $envScriptPs1 | Out-Null
            } elseif (Test-Path $envScriptBat) {
                Write-Info "Importing Emscripten environment (emsdk_env.bat)..."
                $envDump = cmd /c "call `"$envScriptBat`" ^&^& set"
                foreach ($line in $envDump) {
                    if ($line -match "^(?<name>[^=]+)=(?<value>.*)$") {
                        Set-Item -Path ("Env:{0}" -f $Matches.name) -Value $Matches.value
                    }
                }
            } else {
                Write-Warning "emsdk environment script not found; continuing with existing environment variables."
            }

            if (-not $env:EMSDK) { $env:EMSDK = $emsdkPath }
            $emscriptenBin = Join-Path $emsdkPath "upstream/emscripten"
            if ($env:PATH -notmatch [Regex]::Escape($emscriptenBin)) {
                $env:PATH = "$emscriptenBin;$env:PATH"
            }
            if ($env:PATH -notmatch [Regex]::Escape($emsdkPath)) {
                $env:PATH = "$emsdkPath;$env:PATH"
            }
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

# Ensure Orca WASM patch is applied to the submodule
$patchFile = Join-Path $PWD "patches/orca-wasm.patch"
if (Test-Path $patchFile) {
    Write-Info "Ensuring Orca WASM patch is applied..."
    try {
        Push-Location (Join-Path $PWD "orca")
        # Check if patch already applied
        & git apply --reverse --check "..\patches\orca-wasm.patch" 2>$null
        $reverseRc = $LASTEXITCODE
        if ($reverseRc -eq 0) {
            Write-Info "Orca WASM patch already applied"
        } else {
            # Verify patch applicability then apply
            & git apply --check "..\patches\orca-wasm.patch" 2>$null
            $rc = $LASTEXITCODE
            if ($rc -eq 0) {
                & git apply "..\patches\orca-wasm.patch"
                if ($LASTEXITCODE -eq 0) { Write-Success "Applied Orca WASM patch" } else { Write-Warning "Failed to apply Orca WASM patch (git apply). Continuing." }
            } else {
                Write-Warning "Orca WASM patch did not apply cleanly; continuing with current workspace"
            }
        }
    } finally {
        Pop-Location
    }
}

# Ensure Boost headers exist (auto-fetch headers if missing)
$boostPrefix = Join-Path $PWD "deps/boost-wasm/install"
$boostInclude = Join-Path $boostPrefix "include"
$boostVersion = "1.83.0"
$boostDirName = "boost_" + ($boostVersion.Replace('.', '_'))
$boostMarker = Join-Path $boostInclude "boost/version.hpp"

if (!(Test-Path $boostMarker)) {
    Write-Info "Boost headers not found. Fetching Boost $boostVersion headers..."
    $cacheDir = Join-Path $PWD "deps/.cache"
    if (!(Test-Path $cacheDir)) { New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null }
    if (!(Test-Path $boostInclude)) { New-Item -ItemType Directory -Path $boostInclude -Force | Out-Null }

    $archive = Join-Path $cacheDir ("{0}.tar.gz" -f $boostDirName)
    $urls = @(
        "https://archives.boost.io/release/$boostVersion/source/$boostDirName.tar.gz",
        "https://boostorg.jfrog.io/artifactory/main/release/$boostVersion/source/$boostDirName.tar.gz"
    )
    if (!(Test-Path $archive)) {
        $downloaded = $false
        foreach ($u in $urls) {
            try {
                Write-Info "Downloading: $u"
                Invoke-WebRequest -Uri $u -OutFile $archive -UseBasicParsing -TimeoutSec 180
                $downloaded = $true
                break
            } catch {
                Write-Warning ("Download failed from {0}: {1}" -f $u, $_.Exception.Message)
            }
        }
        if (-not $downloaded) {
            Write-Warning "Could not download Boost headers. Build will fall back to WASM shims; some headers may be missing."
        }
    }

    $extractedOk = $false
    if (Test-Path $archive) {
        $extractRoot = Join-Path $cacheDir $boostDirName
        if (Test-Path $extractRoot) { Remove-Item -Recurse -Force $extractRoot }
        # Prefer system tar (available on recent Windows). This extracts to deps/.cache/boost_X_Y_Z
        $tarCmd = Get-Command tar -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($tarCmd) {
            & $tarCmd.Path -xzf $archive -C $cacheDir
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "tar extraction failed with code $LASTEXITCODE."
            } else {
                $extractedOk = $true
            }
        } else {
            Write-Warning "'tar' not found; cannot extract Boost .tar.gz automatically. Please install 7zip or ensure 'tar' is on PATH."
        }

        $srcBoostDir = Join-Path $cacheDir ("{0}/boost" -f $boostDirName)
        if (-not $extractedOk -or -not (Test-Path $srcBoostDir)) {
            # Fallback to .zip archive + Expand-Archive
            $zip = Join-Path $cacheDir ("{0}.zip" -f $boostDirName)
            $downloadedZip = $false
            foreach ($u in @("https://archives.boost.io/release/$boostVersion/source/$boostDirName.zip",
                             "https://boostorg.jfrog.io/artifactory/main/release/$boostVersion/source/$boostDirName.zip")) {
                try {
                    Write-Info "Downloading ZIP: $u"
                    Invoke-WebRequest -Uri $u -OutFile $zip -UseBasicParsing -TimeoutSec 180
                    $downloadedZip = $true
                    break
                } catch {
                    Write-Warning ("Download failed from {0}: {1}" -f $u, $_.Exception.Message)
                }
            }
            if ($downloadedZip) {
                try {
                    if (Test-Path $extractRoot) { Remove-Item -Recurse -Force $extractRoot }
                    Expand-Archive -Path $zip -DestinationPath $cacheDir -Force
                    $extractedOk = $true
                } catch {
                    Write-Warning ("Expand-Archive failed: {0}" -f $_.Exception.Message)
                }
            }
        }

        if (Test-Path $srcBoostDir) {
            Write-Info "Staging Boost headers into $boostInclude"
            $destBoostDir = Join-Path $boostInclude "boost"
            if (Test-Path $destBoostDir) { Remove-Item -Recurse -Force $destBoostDir }
            Copy-Item -Recurse -Force $srcBoostDir $destBoostDir
            if (Test-Path $boostMarker) {
                Write-Success "Boost headers staged."
            } else {
                Write-Warning "Boost headers copy completed but marker not found; proceeding anyway."
            }
        } else {
            Write-Warning "Extracted Boost source not found at $srcBoostDir; proceeding with shim fallback."
        }
    }
}

# Optionally stage CGAL headers (only when explicitly requested). By default
# we rely on WASM shims and build a no-op libslic3r_cgal.
if ($StageCGALHeaders) {
    $mathPrefix = Join-Path $PWD "deps/toolchain-wasm/install"
    $cgalIncludeDir = Join-Path $mathPrefix "include/CGAL"
    $cgalVersionHeader = Join-Path $mathPrefix "include/CGAL/version.h"
    if (!(Test-Path $cgalVersionHeader)) {
        Write-Info "CGAL not staged under deps/toolchain-wasm/install; fetching headers (fallback)."
        $cacheDir = Join-Path $PWD "deps/.cache"
        if (!(Test-Path $cacheDir)) { New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null }
        if (!(Test-Path (Join-Path $mathPrefix "include"))) { New-Item -ItemType Directory -Path (Join-Path $mathPrefix "include") -Force | Out-Null }

        $cgalVersion = "5.4"
        $cgalBase = "CGAL-$cgalVersion"
        $cgalTarXz = Join-Path $cacheDir "$cgalBase.tar.xz"
        $cgalTarGz = Join-Path $cacheDir "$cgalBase.tar.gz"
        $cgalUrls = @(
            "https://github.com/CGAL/cgal/releases/download/v$cgalVersion/$cgalBase.tar.xz",
            "https://github.com/CGAL/cgal/archive/refs/tags/v$cgalVersion.tar.gz"
        )
        $downloaded = $false
        foreach ($u in $cgalUrls) {
            $dest = $cgalTarXz
            if ($u.EndsWith('.tar.gz')) { $dest = $cgalTarGz }
            if (Test-Path $dest) { $downloaded = $true; break }
            try {
                Write-Info "Downloading CGAL: $u"
                Invoke-WebRequest -Uri $u -OutFile $dest -UseBasicParsing -TimeoutSec 180
                $downloaded = $true
                break
            } catch {
                Write-Warning ("CGAL download failed from {0}: {1}" -f $u, $_.Exception.Message)
            }
        }

        $tarCmd = Get-Command tar -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($downloaded -and $tarCmd) {
            $archive = (Test-Path $cgalTarXz) ? $cgalTarXz : $cgalTarGz
            & $tarCmd.Path -xf $archive -C $cacheDir
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Failed to extract CGAL archive ($LASTEXITCODE)."
            } else {
                # Determine extracted directory
                $cgalSrcDir = if (Test-Path (Join-Path $cacheDir $cgalBase)) { Join-Path $cacheDir $cgalBase } else { Join-Path $cacheDir "cgal-$cgalVersion" }
                $srcInc = Join-Path $cgalSrcDir "include/CGAL"
                if (Test-Path $srcInc) {
                    if (Test-Path $cgalIncludeDir) { Remove-Item -Recurse -Force $cgalIncludeDir }
                    Write-Info "Staging CGAL headers -> $cgalIncludeDir"
                    Copy-Item -Recurse -Force $srcInc $cgalIncludeDir
                    if (Test-Path $cgalVersionHeader) {
                        Write-Success "CGAL headers staged."
                    } else {
                        Write-Warning "CGAL version header not found after staging; proceeding anyway."
                    }
                } else {
                    Write-Warning "CGAL include directory not found in extracted archive."
                }
            }
        } else {
            Write-Warning "Could not download or extract CGAL headers; build may fail if CGAL is required."
        }
    }
}

# Clean build directory if requested
if ($Clean -and (Test-Path "build-wasm")) {
    Write-Info "Cleaning build directory..."
    Remove-Item -Recurse -Force "build-wasm"
}

# Set build type
$buildType = if ($Debug) { "Debug" } else { "Release" }

# Configure with CMake
Write-Info "Configuring build with CMake..."
$cmakeArgs = @()
$ninja = Get-Command ninja -ErrorAction SilentlyContinue
if ($ninja) {
    Write-Info "Ninja detected; using Ninja generator."
    $cmakeArgs += @("-G", "Ninja")
}
$cmakeArgs += @(
    "-S", "wasm"
    "-B", "build-wasm"
    "-DCMAKE_BUILD_TYPE=$buildType"
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
    cmake --build build-wasm --config $buildType --parallel $Jobs
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

$wasmFiles = @("slicer.js", "slicer.wasm", "slicer.data")
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
- web/public/wasm/slicer.data

You can now serve the web application or use these files in your web worker.
"@
} else {
    Write-Error "Build completed but some artifacts are missing. Check the build output above."
    exit 1
}
