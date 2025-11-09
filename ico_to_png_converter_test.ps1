# Auto-ekstrakcja ICO do PNG oraz opcjonalne AI upscaling (podobnie do Upscayl)

param(
    [switch]$UseUpscale,  # Jeśli ustawiony, uruchamia AI upscaling po ekstrakcji
    [string]$UpscalerPath = 'realesrgan-ncnn-vulkan.exe',  # Ścieżka do narzędzia upscalingu
    [string]$UpscaleModel = 'models/RealESRGAN_x2plus.pth'  # Model dla upscalera
)

# Załaduj bibliotekę System.Drawing
Add-Type -AssemblyName System.Drawing

# Wykryj pliki .ico
$icoFiles = Get-ChildItem -Path . -Filter '*.ico' | Where-Object { -not $_.PSIsContainer }
if (-not $icoFiles) {
    Write-Host 'Brak plikow ICO w biezacym katalogu.' -ForegroundColor Red
    exit
}

# Wyświetl listę i wybierz plik
Write-Host 'Znaleziono pliki ICO:'
for ($i = 0; $i -lt $icoFiles.Count; $i++) { Write-Host "[$($i+1)] $($icoFiles[$i].Name)" }
do { $sel = Read-Host 'Wybierz numer pliku' } until ([int]::TryParse($sel, [ref]$null) -and $sel -ge 1 -and $sel -le $icoFiles.Count)
$InputPath = $icoFiles[$sel - 1].FullName

# Ustaw ścieżkę wyjściową
$baseName = [IO.Path]::GetFileNameWithoutExtension($InputPath)
$defaultOut = "${baseName}_extracted.png"
$out = Read-Host "Sciezka wyjsciowa [domyslnie: $defaultOut]"
$OutputPath = if ([string]::IsNullOrWhiteSpace($out)) { $defaultOut } else { $out }

# Ekstrakcja bez skalowania
$fs = [System.IO.File]::OpenRead($InputPath)
try {
    $icon = New-Object System.Drawing.Icon($fs)
    $bmp = $icon.ToBitmap()
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host 'Eksport zakonczony bez utraty jakosci:' $OutputPath -ForegroundColor Green
}
finally {
    $bmp.Dispose(); $icon.Dispose(); $fs.Close()
}

# AI upscaling
if ($UseUpscale) {
    if (-Not (Test-Path $UpscalerPath)) {
        Write-Host "Nie znaleziono pliku upscalera: $UpscalerPath" -ForegroundColor Red
        exit 1
    }
    # Detekcja GPU
    $gpuNames = Get-WmiObject Win32_VideoController | Select-Object -ExpandProperty Name
    $supportsVulkan = $false
    foreach ($g in $gpuNames) {
        if ($g -match 'NVIDIA|AMD|Intel') { $supportsVulkan = $true; break }
    }
    $modeParam = ''
    if ($supportsVulkan) {
        Write-Host "Wykryto GPU z mozliwoscia Vulkan: $gpuNames" -ForegroundColor Cyan
        # Real-ESRGAN NCNN Vulkan domyslnie uzywa Vulkan
    } else {
        Write-Host "Nie wykryto wspieranego GPU Vulkan. Uzywam trybu CPU." -ForegroundColor Yellow
        $modeParam = '-g cpu'
    }
    $upscaledOut = "${baseName}_upscaled.png"
    Write-Host "Uruchamiam AI upscaling: $UpscalerPath $modeParam -i $OutputPath -o $upscaledOut -n $UpscaleModel" -ForegroundColor Cyan
    & $UpscalerPath $modeParam -i $OutputPath -o $upscaledOut -n $UpscaleModel
    if ($LASTEXITCODE -eq 0) {
        Write-Host "AI upscaling zakonczony: $upscaledOut" -ForegroundColor Green
    } else {
        Write-Host "Upscaling nie powiódł się. Kod wyjścia: $LASTEXITCODE" -ForegroundColor Red
    }
}
