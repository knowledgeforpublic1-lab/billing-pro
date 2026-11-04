<?php
header('Content-Type: application/json');
http_response_code(403);
echo json_encode([
    'status' => 'error',
    'message' => 'Upload endpoint has been disabled for security purposes. Use Billing Pro native sync.'
]);
exit;
?>
