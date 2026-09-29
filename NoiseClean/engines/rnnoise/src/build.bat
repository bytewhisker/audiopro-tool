@echo off
rem Build script for RNNoise standalone CLI for Windows (x64) using MSVC
setlocal enabledelayedexpansion

echo Building RNNoise CLI for Windows x64...
where cl >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo MSVC cl.exe not in PATH. Attempting to locate vcvars64.bat...
    if exist "%ProgramFiles%\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" (
        call "%ProgramFiles%\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
    ) else if exist "%ProgramFiles%\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
        call "%ProgramFiles%\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
    ) else (
        echo Error: Could not find Visual Studio compiler. Run this script from a Developer Command Prompt.
        exit /b 1
    )
)

cd /d "%~dp0"
if not exist "..\win" mkdir "..\win"

cl /O2 /W3 /D_CRT_SECURE_NO_WARNINGS /Fe:..\win\rnnoise.exe ^
    rnnoise_cli.c celt_lpc.c denoise.c kiss_fft.c pitch.c rnn.c rnn_data.c rnn_reader.c ^
    /I.

if %ERRORLEVEL% EQU 0 (
    echo Successfully built ..\win\rnnoise.exe
    del *.obj 2>nul
) else (
    echo Build failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
