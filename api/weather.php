<?php
// ============================================================
// PROXY PARA API DE CLIMA (HG Brasil)
// Lê a chave do arquivo securite.env (oculto do front-end)
// ============================================================

// ------------------------------------------------------------
// 1. FUNÇÃO PARA CARREGAR VARIÁVEIS DO ARQUIVO .env
// ------------------------------------------------------------
function loadEnv($filePath) {
    if (!file_exists($filePath)) return;
    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Ignora comentários (linhas começando com #)
        if (strpos(trim($line), '#') === 0) continue;
        // Divide na primeira ocorrência de '='
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $value = trim($parts[1]);
            // Remove aspas se houver
            if (preg_match('/^["\'](.*)["\']$/', $value, $matches)) {
                $value = $matches[1];
            }
            putenv("$key=$value");
            $_ENV[$key] = $value;
        }
    }
}

// ------------------------------------------------------------
// 2. CARREGA O ARQUIVO securite.env (na raiz do projeto)
// ------------------------------------------------------------
loadEnv(__DIR__ . '/../securite.env');

// ------------------------------------------------------------
// 3. LÊ A CHAVE DA VARIÁVEL DE AMBIENTE (com fallback seguro)
// ------------------------------------------------------------
$apiKey = getenv('WEATHER_API_KEY');   // Tenta ler do .env
if (empty($apiKey)) {
    // Se não encontrar, para a execução (nunca exponha a chave)
    http_response_code(500);
    echo json_encode(['error' => 'Chave de API não configurada']);
    exit;
}

// Configurações da cidade
$city   = 'Maraba';
$state  = 'PA';

// Monta a URL da API externa
$url = "https://api.hgbrasil.com/weather?key={$apiKey}&city_name={$city},{$state}&locale=pt&format=json";

// Inicia cURL para fazer a requisição
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // se necessário (em produção, mantenha true)
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Define o cabeçalho como JSON
header('Content-Type: application/json');

// Verifica se a requisição foi bem-sucedida
if ($response === false || $httpCode !== 200) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao obter dados do clima']);
    exit;
}

// Decodifica a resposta
$data = json_decode($response, true);

// Verifica se os dados vieram completos
if (!$data || !isset($data['results']) || !isset($data['results']['temp'])) {
    http_response_code(500);
    echo json_encode(['error' => 'Dados inválidos retornados pela API']);
    exit;
}

// Extrai apenas o necessário para o front-end
$result = $data['results'];
$output = [
    'temp'           => $result['temp'],
    'condition_slug' => $result['condition_slug'] ?? ''
];

// Retorna o JSON
echo json_encode($output);