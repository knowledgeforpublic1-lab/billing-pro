<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    
    // Validate if it is valid JSON
    $data = json_decode($input);
    if (json_last_error() === JSON_ERROR_NONE) {
        // Save to data.json
        if (file_put_contents('data.json', $input)) {
            // Also save to data.js for fallback
            $jsContent = "const DATA = " . $input . ";\n";
            file_put_contents('data.js', $jsContent);
            
            http_response_code(200);
            echo json_encode(['status' => 'success', 'message' => 'Data updated successfully.']);
        } else {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Failed to write files. Check permissions.']);
        }
    } else {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON data.']);
    }
} else {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
}
?>
