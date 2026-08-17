Add-Type -AssemblyName System.IO.Compression.FileSystem

$termsDir = Join-Path $PSScriptRoot "..\terms"
$outDir = Join-Path $PSScriptRoot "..\terms\extracted"
if (!(Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$files = Get-ChildItem -Path "$termsDir\*.docx"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)"
    $zip = [System.IO.Compression.ZipFile]::OpenRead($file.FullName)
    $entry = $zip.GetEntry("word/document.xml")
    if ($entry) {
        $stream = $entry.Open()
        $reader = New-Object System.IO.StreamReader($stream)
        $xmlContent = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        
        # Parse XML preserving paragraph breaks
        $xml = [xml]$xmlContent
        $paragraphs = $xml.SelectNodes("//*[local-name()='p']")
        $lines = @()
        foreach ($p in $paragraphs) {
            $tNodes = $p.SelectNodes(".//*[local-name()='t']")
            $pText = ($tNodes | ForEach-Object { $_.InnerText }) -join ""
            if (![string]::IsNullOrWhiteSpace($pText)) {
                $lines += $pText.Trim()
            }
        }
        
        $outFile = Join-Path $outDir ($file.BaseName + ".txt")
        $lines | Out-File -FilePath $outFile -Encoding utf8
        Write-Host "Saved $($lines.Count) paragraphs to $outFile"
    }
    $zip.Dispose()
}

Write-Host "Extraction Complete!"
