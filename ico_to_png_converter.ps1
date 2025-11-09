# Auto-konwerter ICO do PNG z interakcją wyboru plików w bieżącym katalogu

# Załaduj bibliotekę System.Drawing
Add-Type -AssemblyName System.Drawing

# Wykryj pliki .ico w bieżącym katalogu
$icoFiles = Get-ChildItem -Path . -Filter '*.ico' | Where-Object { -not $_.PSIsContainer }
if (-not $icoFiles) {
    Write-Host 'Brak plikow ICO w biezacym katalogu.' -ForegroundColor Red
    exit
}

# Wyświetl listę plików z numerami
Write-Host 'Znaleziono pliki ICO:'
for ($i = 0; $i -lt $icoFiles.Count; $i++) {
    Write-Host "[$($i+1)] $($icoFiles[$i].Name)"
}

# Wybierz plik
do {
    $sel = Read-Host 'Wybierz numer pliku'
} until ([int]::TryParse($sel, [ref]$null) -and $sel -ge 1 -and $sel -le $icoFiles.Count)
$InputPath = $icoFiles[$sel - 1].FullName

# Domyslna sciezka wyjsciowa
$defaultOut = [IO.Path]::ChangeExtension($InputPath, '.png')
$out = Read-Host "Sciezka wyjsciowa [domyslnie: $defaultOut]"
if ([string]::IsNullOrWhiteSpace($out)) { $OutputPath = $defaultOut } else { $OutputPath = $out }

# Wymiary
$wIn = Read-Host 'Szerokosc [domyslnie 256]'
$hIn = Read-Host 'Wysokosc [domyslnie 256]'
if (-not [int]::TryParse($wIn, [ref]$null)) { $Width = 256 } else { $Width = [int]$wIn }
if (-not [int]::TryParse($hIn, [ref]$null)) { $Height = 256 } else { $Height = [int]$hIn }

# Konwersja
$fs = [System.IO.File]::OpenRead($InputPath)
try {
    $icon = New-Object System.Drawing.Icon($fs)
    $bmp = $icon.ToBitmap()
    $res = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($res)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($bmp, 0, 0, $Width, $Height)
    $g.Dispose()
    $res.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host 'Konwersja zakonczona:' $OutputPath -ForegroundColor Green
}
finally {
    $bmp.Dispose()
    $res.Dispose()
    $icon.Dispose()
    $fs.Close()
}
