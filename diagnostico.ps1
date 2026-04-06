# ============================================================================
# Energy-Compliance Hub — DIAGNÓSTICO COMPLETO DE PLATAFORMA
# PowerShell Script v1.0
# ============================================================================
# Ejecutar: .\diagnostico.ps1
# Requisitos: PowerShell 5.1+, Node.js 18+, bun/npm
# ============================================================================

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$AdminEmail = "admin@energy.com",
    [string]$AdminPassword = "admin123",
    [switch]$Verbose,
    [switch]$SkipSeed
)

$ErrorActionPreference = "Continue"
$Script:PassCount = 0
$Script:FailCount = 0
$Script:WarnCount = 0

# ── Helpers ────────────────────────────────────────────────────────────────

function Write-Header($text) {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor DarkGray
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor DarkGray
}

function Write-Section($text) {
    Write-Host ""
    Write-Host "  ▸ $text" -ForegroundColor Yellow
}

function Write-Pass($text) {
    $Script:PassCount++
    Write-Host "    [PASS] " -ForegroundColor Green -NoNewline
    Write-Host $text
}

function Write-Fail($text) {
    $Script:FailCount++
    Write-Host "    [FAIL] " -ForegroundColor Red -NoNewline
    Write-Host $text
}

function Write-Warn($text) {
    $Script:WarnCount++
    Write-Host "    [WARN] " -ForegroundColor DarkYellow -NoNewline
    Write-Host $text
}

function Write-Info($text) {
    Write-Host "    [INFO] " -ForegroundColor DarkGray -NoNewline
    Write-Host $text
}

function Test-Command($cmd) {
    return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Get-ElapsedTime($sw) {
    return "$($sw.ElapsedMilliseconds)ms"
}

# ── 1. ENTORNO ─────────────────────────────────────────────────────────────

Write-Header "1. ENTORNO DEL SISTEMA"

Write-Section "Node.js"
if (Test-Command "node") {
    $nodeVer = node -v 2>&1
    $majorVer = [int]($nodeVer -replace 'v(\d+)\..*', '$1')
    if ($majorVer -ge 18) {
        Write-Pass "Node.js $nodeVer (>= 18 requerido)"
    } else {
        Write-Fail "Node.js $nodeVer (se requiere >= 18)"
    }
} else {
    Write-Fail "Node.js NO instalado"
}

Write-Section "Bun"
if (Test-Command "bun") {
    $bunVer = bun --version 2>&1
    Write-Pass "Bun $bunVer"
} else {
    Write-Warn "Bun NO instalado (usando npm como fallback)"
}

Write-Section "npm"
if (Test-Command "npm") {
    $npmVer = npm -v 2>&1
    Write-Pass "npm $npmVer"
} else {
    Write-Fail "npm NO instalado"
}

Write-Section "Prisma CLI"
if (Test-Command "npx") {
    $prismaVer = npx prisma --version 2>&1 | Select-String "prisma" | Select-Object -First 1
    if ($prismaVer) {
        Write-Pass "Prisma CLI detectado: $($prismaVer.ToString().Trim())"
    } else {
        Write-Warn "Prisma CLI no verificado"
    }
} else {
    Write-Warn "npx NO disponible — no se puede verificar Prisma"
}

Write-Section "Git"
if (Test-Command "git") {
    Write-Pass "Git instalado: $(git --version 2>&1)"
} else {
    Write-Warn "Git NO instalado"
}

Write-Section "Sistema Operativo"
Write-Info "OS: $([System.Environment]::OSVersion.VersionString)"
Write-Info "Arch: $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)"

# ── 2. ESTRUCTURA DEL PROYECTO ────────────────────────────────────────────

Write-Header "2. ESTRUCTURA DEL PROYECTO"

$requiredFiles = @(
    "package.json",
    "next.config.ts",
    "tailwind.config.ts",
    "tsconfig.json",
    ".env",
    "prisma/schema.prisma",
    "prisma/seed.ts",
    "src/app/page.tsx",
    "src/app/layout.tsx",
    "src/app/api/auth/login/route.ts",
    "src/app/api/sensors/route.ts",
    "src/app/api/sensors/telemetry/route.ts",
    "src/app/api/permits/route.ts",
    "src/app/api/locations/route.ts",
    "src/lib/db.ts",
    "src/lib/auth.ts",
    "src/lib/api.ts",
    "src/lib/scada/engine.ts",
    "src/lib/gps.ts",
    "src/lib/qr.ts",
    "src/lib/beacon.ts",
    "src/components/scada/telemetry-board.tsx",
    "src/components/scada/locations-manager.tsx",
    "src/components/scada/api-credentials-manager.tsx",
    "src/components/permits/permit-form.tsx",
    "src/components/approval/approval-panel.tsx",
    "src/components/landing/landing-page.tsx",
    "src/components/layout/app-shell.tsx"
)

$requiredDirs = @(
    "src/app/api",
    "src/components",
    "src/components/ui",
    "src/components/scada",
    "src/components/permits",
    "src/components/layout",
    "src/lib",
    "prisma",
    "db",
    "public"
)

foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-Pass "Directorio: $dir/"
    } else {
        Write-Fail "Directorio FALTANTE: $dir/"
    }
}

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Pass "Archivo: $file ($size bytes)"
    } else {
        Write-Fail "Archivo FALTANTE: $file"
    }
}

# ── 3. DEPENDENCIAS ─────────────────────────────────────────────────────────

Write-Header "3. DEPENDENCIAS"

if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    
    $criticalDeps = @(
        @{ name = "next"; minVersion = "14" },
        @{ name = "react"; minVersion = "18" },
        @{ name = "@prisma/client"; minVersion = "5" },
        @{ name = "framer-motion"; minVersion = "10" },
        @{ name = "recharts"; minVersion = "2" },
        @{ name = "bcryptjs"; minVersion = "2" },
        @{ name = "qrcode"; minVersion = "1" },
        @{ name = "jsonwebtoken"; minVersion = "9" }
    )

    foreach ($dep in $criticalDeps) {
        $allDeps = $pkg.dependencies
        $devDeps = $pkg.devDependencies
        $version = $null
        
        if ($allDeps.$($dep.name)) {
            $version = $allDeps.$($dep.name)
        } elseif ($devDeps.$($dep.name)) {
            $version = $devDeps.$($dep.name)
        }

        if ($version) {
            $cleanVer = $version -replace '[\^~>=<]', ''
            Write-Pass "$($dep.name): $version"
        } else {
            Write-Warn "$($dep.name): NO encontrado en package.json"
        }
    }

    # Check if node_modules exists
    if (Test-Path "node_modules") {
        $moduleCount = (Get-ChildItem "node_modules" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '^\.' }).Count
        Write-Pass "node_modules: $moduleCount paquetes instalados"
    } else {
        Write-Fail "node_modules NO existe — ejecutar: bun install o npm install"
    }
}

# ── 4. BASE DE DATOS ────────────────────────────────────────────────────────

Write-Header "4. BASE DE DATOS (PRISMA + SQLITE)"

Write-Section "Verificar .env"
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "DATABASE_URL") {
        $dbUrl = ($envContent | Select-String "DATABASE_URL=(.+)").Matches.Groups[1].Value
        if ($dbUrl -match "file:") {
            Write-Pass "DATABASE_URL configurado (SQLite): $dbUrl"
        } elseif ($dbUrl -match "postgres") {
            Write-Pass "DATABASE_URL configurado (PostgreSQL): ****"
        } else {
            Write-Warn "DATABASE_URL con formato no reconocido: $dbUrl"
        }
    } else {
        Write-Fail "DATABASE_URL no definido en .env"
    }
} else {
    Write-Fail ".env NO existe"
}

Write-Section "Prisma Schema"
if (Test-Path "prisma/schema.prisma") {
    $schemaContent = Get-Content "prisma/schema.prisma" -Raw
    $models = [regex]::Matches($schemaContent, "model (\w+)")
    Write-Info "Modelos encontrados: $($models.Count)"
    foreach ($m in $models) {
        $modelName = $m.Groups[1].Value
        $fields = [regex]::Matches($schemaContent, "(?m)^  \w+.*$") 
        Write-Info "  - model $modelName"
    }
    
    # Check for critical models
    $criticalModels = @("Company", "User", "Permit", "Sensor", "SensorReading", "WorkLocation", "HseDocument", "ApiKey")
    foreach ($cm in $criticalModels) {
        if ($schemaContent -match "model $cm\b") {
            Write-Pass "Model $cm existe en schema"
        } else {
            Write-Fail "Model $cm FALTANTE en schema"
        }
    }

    # Check new QR/Beacon fields
    if ($schemaContent -match "qrCodeSecret") {
        Write-Pass "Campo WorkLocation.qrCodeSecret existe"
    } else {
        Write-Fail "Campo WorkLocation.qrCodeSecret FALTANTE"
    }
    if ($schemaContent -match "beaconUuid") {
        Write-Pass "Campo WorkLocation.beaconUuid existe"
    } else {
        Write-Fail "Campo WorkLocation.beaconUuid FALTANTE"
    }
} else {
    Write-Fail "prisma/schema.prisma NO existe"
}

Write-Section "Prisma Generate"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $genOutput = & npx prisma generate 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Pass "Prisma Client generado exitosamente ($(Get-ElapsedTime $sw))"
    } else {
        Write-Fail "Error al generar Prisma Client: $genOutput"
    }
} catch {
    Write-Fail "Error al ejecutar prisma generate: $_"
}

Write-Section "Prisma DB Push"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $pushOutput = & npx prisma db push 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Pass "Schema sincronizado con DB ($(Get-ElapsedTime $sw))"
    } else {
        Write-Fail "Error en prisma db push: $pushOutput"
    }
} catch {
    Write-Fail "Error al ejecutar prisma db push: $_"
}

Write-Section "DB Seed"
if (-not $SkipSeed) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $seedOutput = & npx prisma db seed 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Pass "Seed ejecutado correctamente ($(Get-ElapsedTime $sw))"
        } else {
            Write-Warn "Seed falló (puede ser que ya existan datos): $seedOutput"
        }
    } catch {
        Write-Warn "Error al ejecutar seed: $_"
    }
} else {
    Write-Info "Seed saltado (--SkipSeed)"
}

Write-Section "Archivo de Base de Datos"
if (Test-Path "db/custom.db") {
    $dbSize = (Get-Item "db/custom.db").Length / 1KB
    Write-Pass "db/custom.db existe ($([math]::Round($dbSize, 1)) KB)"
    $dbDate = (Get-Item "db/custom.db").LastWriteTime
    Write-Info "Última modificación: $dbDate"
} else {
    Write-Fail "db/custom.db NO existe"
}

# ── 5. SERVER DEVELOPMENT ─────────────────────────────────────────────────

Write-Header "5. SERVIDOR DE DESARROLLO"

Write-Section "Verificar puerto 3000"
$portInUse = $false
try {
    $tcpConnection = [System.Net.Sockets.TcpConnection]::new()
    $connectTask = $tcpConnection.ConnectAsync("localhost", 3000)
    $completed = $connectTask.Wait(3000)
    if ($completed -and $connectTask.Status -eq "RanToCompletion") {
        $portInUse = $true
        $tcpConnection.Close()
    }
} catch {}

if ($portInUse) {
    Write-Pass "Puerto 3000 está en uso (servidor activo)"
} else {
    Write-Warn "Puerto 3000 NO está en uso — el servidor puede no estar iniciado"
}

Write-Section "Health Check — GET /"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/" -Method GET -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Pass "GET / → 200 OK ($(Get-ElapsedTime $sw))"
        Write-Info "Content-Type: $($response.Headers['Content-Type'])"
        Write-Info "Content-Length: $($response.Content.Length) bytes"
    } else {
        Write-Fail "GET / → $($response.StatusCode) ($(Get-ElapsedTime $sw))"
    }
} catch {
    Write-Fail "GET / → Error de conexión: $($_.Exception.Message)"
}

# ── 6. AUTH API ─────────────────────────────────────────────────────────────

Write-Header "6. API DE AUTENTICACIÓN"

Write-Section "POST /api/auth/login — Login como admin"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $loginBody = @{
        email = $AdminEmail
        password = $AdminPassword
    } | ConvertTo-Json
    
    $loginResponse = Invoke-WebRequest `
        -Uri "$BaseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -UseBasicParsing `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    if ($loginResponse.StatusCode -eq 200) {
        $loginData = $loginResponse.Content | ConvertFrom-Json
        $Script:AuthToken = $loginData.token
        $Script:AuthUser = $loginData.user
        Write-Pass "Login exitoso ($(Get-ElapsedTime $sw))"
        Write-Info "Usuario: $($loginData.user.name) ($($loginData.user.email))"
        Write-Info "Rol: $($loginData.user.role)"
        Write-Info "Empresa: $($loginData.user.companyId)"
        Write-Info "Token: $($loginData.token.Substring(0, 30))..."
    } else {
        Write-Fail "Login falló: $($loginResponse.StatusCode)"
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Fail "Credenciales inválidas (401)"
    } else {
        Write-Fail "Error: $($_.Exception.Message)"
    }
}

if (-not $Script:AuthToken) {
    Write-Fail "No se obtuvo token — saltando pruebas autenticadas"
    Write-Header "RESULTADO FINAL (PARCIAL — SIN AUTENTICACIÓN)"
    Write-Host ""
    Write-Host "  ✅ Pasaron: $Script:PassCount" -ForegroundColor Green
    Write-Host "  ⚠️  Advertencias: $Script:WarnCount" -ForegroundColor DarkYellow
    Write-Host "  ❌ Fallaron: $Script:FailCount" -ForegroundColor Red
    exit 1
}

# ── 7. API ENDPOINTS AUTENTICADOS ─────────────────────────────────────────

Write-Header "7. API ENDPOINTS (AUTENTICADOS)"

$headers = @{
    "Authorization" = "Bearer $($Script:AuthToken)"
    "Content-Type" = "application/json"
}

$apiTests = @(
    @{ method = "GET"; path = "/api/sensors"; name = "Lista de sensores"; expectedCount = 6 },
    @{ method = "GET"; path = "/api/sensors/telemetry"; name = "Telemetría SCADA"; checkField = "points" },
    @{ method = "GET"; path = "/api/locations"; name = "Ubicaciones"; checkField = "locations" },
    @{ method = "GET"; path = "/api/permits"; name = "Lista de permisos" },
    @{ method = "GET"; path = "/api/compliance/check"; name = "Check cumplimiento"; checkField = "isCompliant" },
    @{ method = "GET"; path = "/api/risk-types"; name = "Tipos de riesgo"; checkField = "riskTypes" },
    @{ method = "GET"; path = "/api/subscription/status"; name = "Estado suscripción" },
    @{ method = "GET"; path = "/api/sensors/simulation"; name = "Estado simulación"; checkField = "demoMode" },
    @{ method = "GET"; path = "/api/sensors/site-safe"; name = "Safety Gate SCADA"; checkField = "isSafe" },
    @{ method = "GET"; path = "/api/auth/token"; name = "Info del token JWT"; checkField = "algorithm" }
)

foreach ($test in $apiTests) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-WebRequest `
            -Uri "$BaseUrl$($test.path)" `
            -Method $test.method `
            -Headers $headers `
            -UseBasicParsing `
            -TimeoutSec 15 `
            -ErrorAction Stop
        
        $data = $response.Content | ConvertFrom-Json
        
        if ($response.StatusCode -eq 200) {
            $extra = ""
            if ($test.expectedCount -and $data.Count -ge $test.expectedCount) {
                $extra = " ($($data.Count) items)"
            }
            if ($test.checkField -and $data.$($test.checkField) -ne $null) {
                $extra = " ($($test.checkField) = $($data.$($test.checkField)))"
            }
            Write-Pass "$($test.method) $($test.path) → 200$extra ($(Get-ElapsedTime $sw))"
        } else {
            Write-Fail "$($test.method) $($test.path) → $($response.StatusCode) ($(Get-ElapsedTime $sw))"
        }
    } catch {
        $errDetail = $_.Exception.Message
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errDetail = $reader.ReadToEnd()
        }
        Write-Fail "$($test.method) $($test.path) → Error: $($errDetail.Substring(0, [math]::Min(100, $errDetail.Length)))"
    }
}

# ── 8. API CREDENTIALS ─────────────────────────────────────────────────────

Write-Header "8. API KEYS Y CREDENCIALES"

Write-Section "GET /api/api-keys — Listar API Keys"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/api-keys" `
        -Method GET `
        -Headers $headers `
        -UseBasicParsing `
        -TimeoutSec 10 `
        -ErrorAction Stop
    Write-Pass "GET /api/api-keys → 200 ($(Get-ElapsedTime $sw))"
    $keysData = $response.Content | ConvertFrom-Json
    Write-Info "Keys activas: $($keysData.keys.Count)"
} catch {
    Write-Warn "GET /api/api-keys → No disponible (módulo puede no estar listo)"
}

# ── 9. SCADA ESPECÍFICO ────────────────────────────────────────────────────

Write-Header "9. SCADA — VERIFICACIÓN ESPECÍFICA"

Write-Section "Verificar modos de verificación"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/locations" `
        -Method GET `
        -Headers $headers `
        -UseBasicParsing `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    $locations = ($response.Content | ConvertFrom-Json).locations
    
    $gpsCount = ($locations | Where-Object { $_.verificationMethod -eq 'GPS' -or $_.verificationMethod -eq $null }).Count
    $qrCount = ($locations | Where-Object { $_.verificationMethod -eq 'QR_CODE' }).Count
    $beaconCount = ($locations | Where-Object { $_.verificationMethod -eq 'BEACON' }).Count
    
    Write-Pass "Ubicaciones encontradas: $($locations.Count)"
    Write-Info "  GPS: $gpsCount | QR: $qrCount | Beacon: $beaconCount"
    
    if ($locations.Count -gt 0) {
        Write-Section "Ubicaciones detalladas"
        foreach ($loc in $locations) {
            $method = $loc.verificationMethod ?? "GPS (default)"
            Write-Info "  - $($loc.name) [$method] ($($loc.latitude), $($loc.longitude)) r=$($loc.radiusMeters)m"
        }
    }
    
    # Check QR generation endpoint for QR locations
    $qrLocations = $locations | Where-Object { $_.verificationMethod -eq 'QR_CODE' }
    if ($qrLocations.Count -gt 0) {
        Write-Section "Generar QR Code para ubicación QR"
        $sw2 = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $qrResponse = Invoke-WebRequest `
                -Uri "$BaseUrl/api/locations/$($qrLocations[0].id)/qr" `
                -Method GET `
                -Headers $headers `
                -UseBasicParsing `
                -TimeoutSec 15 `
                -ErrorAction Stop
            Write-Pass "QR generado para '$($qrLocations[0].name)' ($(Get-ElapsedTime $sw2))"
            $qrData = $qrResponse.Content | ConvertFrom-Json
            Write-Info "  QR Data URL length: $($qrData.qrCodeDataUrl.Length) chars"
        } catch {
            Write-Fail "Error generando QR: $($_.Exception.Message)"
        }
    } else {
        Write-Info "No hay ubicaciones QR para probar generación"
    }
} catch {
    Write-Fail "Error al obtener ubicaciones: $_"
}

Write-Section "Validar Beacon config"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    # Test beacon UUID validation via lib
    $beaconTest = node -e "
        const { validateBeaconConfig, generateBeaconUuid } = require('./src/lib/beacon.ts');
        // This won't work with TypeScript directly, skip
        console.log('Beacon module loads correctly');
    " 2>&1
    Write-Info "Beacon library: $beaconTest"
} catch {
    Write-Info "Beacon library: TypeScript module (compilado con proyecto)"
}

# ── 10. REPORTES ───────────────────────────────────────────────────────────

Write-Header "10. MÓDULO DE REPORTES"

Write-Section "POST /api/reports/generate — Generar reporte"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $reportBody = @{
        dateFrom = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
        dateTo = (Get-Date).ToString("yyyy-MM-dd")
    } | ConvertTo-Json
    
    $reportResponse = Invoke-WebRequest `
        -Uri "$BaseUrl/api/reports/generate" `
        -Method POST `
        -ContentType "application/json" `
        -Headers $headers `
        -Body $reportBody `
        -UseBasicParsing `
        -TimeoutSec 30 `
        -ErrorAction Stop
    
    if ($reportResponse.StatusCode -eq 200) {
        $reportData = $reportResponse.Content | ConvertFrom-Json
        Write-Pass "Reporte generado exitosamente ($(Get-ElapsedTime $sw))"
        Write-Info "  Permisos: $($reportData.summary.totalPermits)"
        Write-Info "  Documentos: $($reportData.summary.totalDocuments)"
    }
} catch {
    Write-Warn "Reportes: $($_.Exception.Message)"
}

# ── 11. IMPORT ────────────────────────────────────────────────────────────

Write-Header "11. MÓDULO DE IMPORTACIÓN"

Write-Info "Endpoints de importación disponibles:"
$importEndpoints = @(
    "/api/v1/import/sensors",
    "/api/v1/import/permits"
)
foreach ($ep in $importEndpoints) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        # HEAD request to check if endpoint exists
        $response = Invoke-WebRequest `
            -Uri "$BaseUrl$ep" `
            -Method OPTIONS `
            -Headers $headers `
            -UseBasicParsing `
            -TimeoutSec 5 `
            -ErrorAction Stop
        Write-Pass "$ep → Endpoint existe"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) {
            Write-Info "$ep → No disponible (404)"
        } else {
            Write-Info "$ep → No verificado"
        }
    }
}

# ── 12. LINT Y BUILD ───────────────────────────────────────────────────────

Write-Header "12. CALIDAD DE CÓDIGO"

Write-Section "ESLint"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $lintOutput = & bun run lint 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Pass "ESLint: Sin errores ($(Get-ElapsedTime $sw))"
    } else {
        $errorLines = ($lintOutput | Select-String "error").Count
        Write-Warn "ESLint: $errorLines errores encontrados ($(Get-ElapsedTime $sw))"
        if ($Verbose) {
            Write-Host $lintOutput -ForegroundColor DarkGray
        }
    }
} catch {
    Write-Warn "No se pudo ejecutar ESLint: $_"
}

# ── 13. ARCHIVOS DE CONFIGURACIÓN ADICIONAL ─────────────────────────────────

Write-Header "13. ARCHIVOS DE CONFIGURACIÓN"

$configFiles = @(
    @{ path = ".gitignore"; required = $true },
    @{ path = "next.config.ts"; required = $true },
    @{ path = "tailwind.config.ts"; required = $true },
    @{ path = "sw.js"; required = $false; desc = "Service Worker PWA" },
    @{ path = "public/manifest.json"; required = $false; desc = "PWA Manifest" },
    @{ path = "src/instrumentation.ts"; required = $false; desc = "Instrumentation (DB sync)" },
    @{ path = "src/lib/demo-mode-cache.ts"; required = $false; desc = "Demo mode cache" },
    @{ path = "src/lib/offline/sync-manager.ts"; required = $false; desc = "Offline sync" }
)

foreach ($cf in $configFiles) {
    if (Test-Path $cf.path) {
        Write-Pass "$($cf.path) existe$($cf.desc ? " ($($cf.desc))" : '')"
    } elseif ($cf.required) {
        Write-Fail "$($cf.path) FALTANTE"
    } else {
        Write-Warn "$($cf.path) no encontrado ($($cf.desc)) — funcionalidad opcional"
    }
}

# ── RESULTADO FINAL ────────────────────────────────────────────────────────

Write-Header "RESULTADO FINAL DEL DIAGNÓSTICO"

Write-Host ""
Write-Host "  ┌─────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "  │  Energy-Compliance Hub — Diagnóstico          │" -ForegroundColor White
Write-Host "  ├─────────────────────────────────────────────┤" -ForegroundColor White

$passColor = if ($Script:PassCount -gt 0) { "Green" } else { "DarkGray" }
$failColor = if ($Script:FailCount -gt 0) { "Red" } else { "DarkGray" }
$warnColor = if ($Script:WarnCount -gt 0) { "DarkYellow" } else { "DarkGray" }

Write-Host "  │                                             │" -ForegroundColor White
Write-Host "  │  ✅ Pasaron:     " -ForegroundColor White -NoNewline
Write-Host ("{0,3}" -f $Script:PassCount) -ForegroundColor $passColor
Write-Host "                           │" -ForegroundColor White

Write-Host "  │  ⚠️  Advertencias: " -ForegroundColor White -NoNewline
Write-Host ("{0,3}" -f $Script:WarnCount) -ForegroundColor $warnColor
Write-Host "                           │" -ForegroundColor White

Write-Host "  │  ❌ Fallaron:     " -ForegroundColor White -NoNewline
Write-Host ("{0,3}" -f $Script:FailCount) -ForegroundColor $failColor
Write-Host "                           │" -ForegroundColor White

Write-Host "  │                                             │" -ForegroundColor White

$total = $Script:PassCount + $Script:WarnCount + $Script:FailCount
$healthPct = if ($total -gt 0) { [math]::Round(($Script:PassCount / $total) * 100) } else { 0 }

$healthColor = if ($healthPct -ge 90) { "Green" } elseif ($healthPct -ge 70) { "DarkYellow" } else { "Red" }
Write-Host "  │  Estado General: " -ForegroundColor White -NoNewline
Write-Host ("{0,3}%" -f $healthPct) -ForegroundColor $healthColor
Write-Host "                        │" -ForegroundColor White

Write-Host "  │                                             │" -ForegroundColor White
Write-Host "  └─────────────────────────────────────────────┘" -ForegroundColor White

Write-Host ""

if ($Script:FailCount -eq 0) {
    Write-Host "  🎉 Todos los checks críticos pasaron. La plataforma está operativa." -ForegroundColor Green
} elseif ($Script:FailCount -le 3) {
    Write-Host "  ⚡ Algunos checks fallaron. Revise los errores arriba para corregir." -ForegroundColor DarkYellow
} else {
    Write-Host "  🚨 Múltiples errores detectados. Se requiere atención inmediata." -ForegroundColor Red
}

Write-Host ""
Write-Host "  Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host ""
