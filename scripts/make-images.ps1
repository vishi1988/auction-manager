# Draws the share-preview picture (WhatsApp / Facebook, 1200x630) and the
# phone home-screen icon (180x180) into site/assets/.
# Run from the project folder: powershell -ExecutionPolicy Bypass -File scripts\make-images.ps1
Add-Type -AssemblyName System.Drawing

$out = Join-Path (Get-Location) 'site\assets'
New-Item -ItemType Directory -Force $out | Out-Null

function Font($names, [float]$size, $style) {
  foreach ($n in $names) {
    $f = New-Object System.Drawing.Font($n, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    if ($f.Name -eq $n) { return $f }
  }
  return New-Object System.Drawing.Font('Arial', $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}
$display = @('Bahnschrift', 'Arial Narrow', 'Arial')
$dot = [string][char]0x00B7
$typo = [System.Drawing.StringFormat]::GenericTypographic
$body = @('Segoe UI Semibold', 'Segoe UI', 'Arial')

$navy = [System.Drawing.Color]::FromArgb(11, 18, 32)
$gold = [System.Drawing.Color]::FromArgb(242, 182, 49)
$goldHi = [System.Drawing.Color]::FromArgb(255, 227, 161)
$muted = [System.Drawing.Color]::FromArgb(166, 178, 198)

function GoldBrush($rect) {
  $b = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $goldHi, [System.Drawing.Color]::FromArgb(176, 122, 18), 90)
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend(4)
  $blend.Colors = @($goldHi, $gold, [System.Drawing.Color]::FromArgb(176, 122, 18), $goldHi)
  $blend.Positions = @(0.0, 0.42, 0.7, 1.0)
  $b.InterpolationColors = $blend
  return $b
}

function RoundRect($g, $brush, $x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $r, $r, 180, 90); $p.AddArc($x + $w - $r, $y, $r, $r, 270, 90)
  $p.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90); $p.AddArc($x, $y + $h - $r, $r, $r, 90, 90)
  $p.CloseFigure(); $g.FillPath($brush, $p)
}

# ---------- share picture ----------
$bmp = New-Object System.Drawing.Bitmap(1200, 630)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(0, 0, 1200, 630)), [System.Drawing.Color]::FromArgb(27, 42, 85), $navy, 35)
$g.FillRectangle($bg, 0, 0, 1200, 630)
# floodlight beam
$beam = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(14, 255, 255, 255))
$g.FillPolygon($beam, @((New-Object System.Drawing.Point(820, 0)), (New-Object System.Drawing.Point(900, 0)), (New-Object System.Drawing.Point(1150, 630)), (New-Object System.Drawing.Point(700, 630))))

RoundRect $g (GoldBrush (New-Object System.Drawing.Rectangle(80, 80, 96, 96))) 80 80 96 96 24
$g.DrawString('KA', (Font $display 54 'Bold'), (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26, 18, 4))), 92, 98)

$titleFont = Font $display 112 'Bold'
$g.DrawString('KHILADI', $titleFont, [System.Drawing.Brushes]::White, 80, 220, $typo)
$w = $g.MeasureString('KHILADI', $titleFont, 2000, $typo).Width
$g.DrawString('AUCTION', $titleFont, (GoldBrush (New-Object System.Drawing.Rectangle(0, 225, 1200, 120))), 80 + $w + 6, 220, $typo)
$g.DrawString('Live player auction app for local leagues', (Font $body 38 'Regular'), [System.Drawing.Brushes]::White, 80, 360)
$g.DrawString("CRICKET  $dot  KABADDI  $dot  FOOTBALL  $dot  VOLLEYBALL", (Font $body 24 'Bold'), (New-Object System.Drawing.SolidBrush($muted)), 82, 430)
$g.DrawString("Teams $dot Purse $dot Live bidding $dot SOLD screen $dot Lucky draw", (Font $body 26 'Regular'), (New-Object System.Drawing.SolidBrush($gold)), 82, 520)
$bmp.Save((Join-Path $out 'og-image.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

# ---------- home-screen icon ----------
$bmp = New-Object System.Drawing.Bitmap(180, 180)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear($navy)
RoundRect $g (GoldBrush (New-Object System.Drawing.Rectangle(14, 14, 152, 152))) 14 14 152 152 34
$f = Font $display 92 'Bold'
$s = $g.MeasureString('KA', $f)
$g.DrawString('KA', $f, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26, 18, 4))), (180 - $s.Width) / 2, (180 - $s.Height) / 2 + 2)
$bmp.Save((Join-Path $out 'apple-touch-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "Wrote og-image.png and apple-touch-icon.png to $out"
