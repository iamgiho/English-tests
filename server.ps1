$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://127.0.0.1:8765/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
  Write-Host "내신 대비 영어 퀴즈 서버가 실행 중입니다."
  Write-Host $prefix
  Write-Host "종료하려면 이 창에서 Ctrl+C를 누르세요."

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "index.html"
    }

    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $requestPath))
    if (-not $fullPath.StartsWith([System.IO.Path]::GetFullPath($root))) {
      $context.Response.StatusCode = 403
      $context.Response.Close()
      continue
    }

    if (-not [System.IO.File]::Exists($fullPath)) {
      $context.Response.StatusCode = 404
      $context.Response.Close()
      continue
    }

    $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
    $contentType = switch ($extension) {
      ".html" { "text/html; charset=utf-8" }
      ".json" { "application/json; charset=utf-8" }
      ".txt" { "text/plain; charset=utf-8" }
      ".css" { "text/css; charset=utf-8" }
      ".js" { "text/javascript; charset=utf-8" }
      default { "application/octet-stream" }
    }

    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $context.Response.ContentType = $contentType
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
}
finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
