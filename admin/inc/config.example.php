<?php
// admin/inc/config.example.php
// Скопировать в admin/inc/config.php и заполнить реальными значениями.
// config.php НЕ коммитится в git (см. .gitignore).

return [
    // Логин и хэш пароля. Хэш генерируется так:
    //   php admin/inc/_make-hash.php "ваш-пароль"
    // или в любом онлайн-генераторе bcrypt.
    'admin_username'      => 'admin',
    'admin_password_hash' => '$2y$12$REPLACE_ME_WITH_REAL_HASH....',

    // Случайная строка для подписи сессий/csrf. 32+ символа.
    'app_secret'          => 'CHANGE_ME_TO_RANDOM_32_CHARS_OR_MORE',

    // Куда писать SQLite. Относительно корня проекта.
    // На REG.RU это /www/promliz.com/data/orders.sqlite — папка ВНЕ admin/.
    'db_path'             => __DIR__ . '/../../data/orders.sqlite',

    // Email уведомлений о новых заявках. Если пусто — не шлём.
    'notify_email'        => 'promlizing@inbox.ru',
    'notify_from'         => 'no-reply@promliz.com',

    // Разрешённые источники для POST на /admin/api/submit.php (CORS).
    // Пустой массив = принимать только same-origin.
    'allowed_origins'     => [
        'https://promliz.com',
        'https://www.promliz.com',
    ],

    // Включить https-only куки. На локалке выключить, на проде включить.
    'cookie_secure'       => true,

    // Часовой пояс админки.
    'timezone'            => 'Europe/Moscow',
];
