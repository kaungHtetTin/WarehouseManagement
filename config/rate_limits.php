<?php

return [
    'api_per_minute' => (int) env('API_RATE_LIMIT_PER_MINUTE', 300),
    'login_max_attempts' => (int) env('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', 10),
    'login_decay_seconds' => (int) env('LOGIN_RATE_LIMIT_DECAY_SECONDS', 60),
];
