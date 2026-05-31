# Админка Промлизинга

Простая PHP-админка для приёма и управления заявками с сайта.
Не зависит от фреймворков, БД — SQLite (файл).

## Что умеет

- Принимать заявки с формы сайта (`/admin/api/submit.php`)
- Дублировать заявки на почту `promlizing@inbox.ru`
- Показывать дашборд: счётчики, график за 30 дней, последние 10 заявок
- Список заявок: поиск, фильтр по статусу, сортировка, пагинация
- Карточка заявки: статус, заметка, удаление
- Экспорт CSV (Excel/Numbers/Google Sheets)
- Защита: bcrypt-пароль, rate-limit на логин и приём заявок, CSRF на внутренние формы

## Где работает

- **Прод (когда переедем на REG.RU):** http://promliz.com/admin/
- **GitHub Pages:** НЕ работает (PHP нет). Папка `admin/` исключена из build.

## Локальный запуск (для проверки)

Нужен Docker Desktop.

```bash
# Запустить Docker Desktop, потом:
cd admin
docker compose up
```

Открыть http://localhost:8088/admin/ — логин `admin` / пароль `test1234`.

Конфиг для локалки создаётся автоматически (`admin/inc/config.php`).
Для прода его надо пересоздать — см. ниже.

## Деплой на REG.RU (один раз)

### Шаг 1. Сгенерировать хэш пароля

На любой машине с PHP (или через https://bcrypt-generator.com/, rounds=12):

```bash
php admin/inc/_make-hash.php "ваш-пароль-минимум-8-символов"
```

Выйдет строка вида `$2y$12$abc...`. Скопировать.

### Шаг 2. Создать config.php

Скопировать `admin/inc/config.example.php` → `admin/inc/config.php`,
заполнить:

```php
'admin_username'      => 'promlizadmin',           // ваш логин
'admin_password_hash' => '$2y$12$ваш-хэш-из-шага-1',
'app_secret'          => 'случайная-строка-32+',   // генератор: openssl rand -hex 32
'notify_email'        => 'promlizing@inbox.ru',
'cookie_secure'       => true,                      // обязательно true на проде с HTTPS
```

### Шаг 3. Залить файлы по FTP в `/www/promliz.com/`

```
admin/                  — вся папка целиком (включая inc/, api/, assets/, .htaccess)
data/                   — пустая папка с .htaccess (PHP создаст SQLite сам)
```

В FileZilla / Total Commander: убедиться, что `admin/inc/config.php` залит
с реальными кредами, а не пример.

### Шаг 4. Права на data/

В ISPmanager / FTP-клиенте: `data/` должна быть доступна на запись (775 или 755).
PHP создаст `data/orders.sqlite` при первой заявке.

### Шаг 5. Проверка

1. Открыть https://promliz.com/admin/login.php — должна показаться форма входа
2. Войти → дашборд (0 заявок)
3. Отправить тестовую заявку с сайта → проверить, что появилась в админке
4. Открыть карточку → поменять статус → нажать Сохранить
5. Экспорт → скачать CSV → открыть в Excel

## Структура

```
admin/
├── index.php              ← Дашборд
├── login.php              ← Логин
├── logout.php
├── applications.php       ← Список заявок (поиск, фильтр)
├── application.php        ← Карточка заявки
├── export.php             ← CSV
├── inc/                   ← Бэкенд (закрыт от прямого доступа)
│   ├── bootstrap.php      ← общий init
│   ├── config.example.php ← пример конфига (в git)
│   ├── config.php         ← реальный конфиг (.gitignore)
│   ├── _make-hash.php     ← утилита для пароля
│   ├── db.php             ← PDO SQLite + миграции
│   ├── auth.php           ← сессия + rate-limit
│   ├── csrf.php
│   ├── helpers.php
│   ├── header.php / footer.php
│   └── .htaccess          ← Require all denied
├── api/
│   ├── submit.php         ← приём заявок с формы сайта
│   └── update.php         ← AJAX: изменить статус/заметку/удалить
├── assets/
│   ├── admin.css
│   └── admin.js
├── .htaccess              ← заголовки no-cache, deny листинга
├── docker-compose.yml     ← локальная разработка
└── README.md              ← этот файл

data/                       ← на сервере; БД заявок
├── .htaccess              ← Require all denied
├── .gitignore             ← не коммитим SQLite
└── orders.sqlite          ← создаётся PHP при первой заявке
```

## Бэкап БД

Заявки — это файл `data/orders.sqlite`. Скачать по FTP → копия готова.
Восстановить — залить обратно с заменой.

Рекомендация: настроить раз в неделю бэкап в ISPmanager или просто
руками скачивать раз в месяц.

## Как обновлять

1. Поправить файл локально
2. Залить по FTP с заменой
3. БД и `config.php` не трогать — они на сервере и в `.gitignore`

## Что НЕ сделано (умышленно — можно добавить позже)

- Редактирование контента сайта (FAQ, кейсы) — сайт статический, редактируется в репо
- Несколько админов — пока один логин
- 2FA — не нужно для одного юзера
- Telegram-уведомления — добавим если Стёпа попросит
- Графики посложнее — пока хватает линии за 30 дней

## Контакты

Вопросы — Клоду в чат. Если что-то лежит — сначала проверить:
- `data/orders.sqlite` существует и доступен на запись?
- `admin/inc/config.php` существует и читается?
- PHP errror log — на REG.RU обычно в ISPmanager → Сайты → лог ошибок
