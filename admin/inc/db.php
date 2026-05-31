<?php
// admin/inc/db.php — обёртка SQLite (PDO) + миграции.
//
// Использование:
//   $db = db();
//   $row = $db->fetch('SELECT * FROM applications WHERE id = ?', [$id]);
//   $list = $db->fetchAll('SELECT * FROM applications LIMIT 10');
//   $id = $db->insert('applications', ['name' => '...', 'phone' => '...']);

declare(strict_types=1);

final class Db
{
    private PDO $pdo;

    public function __construct(string $path)
    {
        $dir = dirname($path);
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
                throw new RuntimeException("Не могу создать папку для БД: $dir");
            }
        }

        $this->pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        $this->pdo->exec('PRAGMA journal_mode = WAL');
        $this->pdo->exec('PRAGMA foreign_keys = ON');
        $this->pdo->exec('PRAGMA busy_timeout = 5000');

        $this->migrate();
    }

    public function pdo(): PDO { return $this->pdo; }

    public function fetch(string $sql, array $params = []): ?array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($params);
        $row = $st->fetch();
        return $row === false ? null : $row;
    }

    public function fetchAll(string $sql, array $params = []): array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($params);
        return $st->fetchAll();
    }

    public function fetchValue(string $sql, array $params = []): mixed
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($params);
        $v = $st->fetchColumn();
        return $v === false ? null : $v;
    }

    public function exec(string $sql, array $params = []): int
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($params);
        return $st->rowCount();
    }

    public function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $place = array_map(fn($c) => ':' . $c, $cols);
        $sql = 'INSERT INTO ' . $table . ' (' . implode(',', $cols) . ') VALUES (' . implode(',', $place) . ')';
        $st = $this->pdo->prepare($sql);
        foreach ($data as $k => $v) {
            $st->bindValue(':' . $k, $v, $this->detectType($v));
        }
        $st->execute();
        return (int)$this->pdo->lastInsertId();
    }

    public function update(string $table, array $data, string $where, array $whereParams = []): int
    {
        $sets = [];
        foreach (array_keys($data) as $c) {
            $sets[] = "$c = :$c";
        }
        $sql = "UPDATE $table SET " . implode(', ', $sets) . " WHERE $where";
        $st = $this->pdo->prepare($sql);
        foreach ($data as $k => $v) {
            $st->bindValue(':' . $k, $v, $this->detectType($v));
        }
        foreach ($whereParams as $k => $v) {
            $st->bindValue(is_int($k) ? $k + 1 : ':' . $k, $v, $this->detectType($v));
        }
        $st->execute();
        return $st->rowCount();
    }

    private function detectType(mixed $v): int
    {
        if ($v === null) return PDO::PARAM_NULL;
        if (is_int($v)) return PDO::PARAM_INT;
        if (is_bool($v)) return PDO::PARAM_BOOL;
        return PDO::PARAM_STR;
    }

    private function migrate(): void
    {
        $current = (int)$this->pdo->query('PRAGMA user_version')->fetchColumn();

        $migrations = [
            1 => <<<SQL
                CREATE TABLE applications (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at   INTEGER NOT NULL,
                    name         TEXT    NOT NULL,
                    phone        TEXT    NOT NULL,
                    email        TEXT,
                    inn          TEXT,
                    comment      TEXT,
                    source_page  TEXT,
                    user_agent   TEXT,
                    ip           TEXT,
                    status       TEXT    NOT NULL DEFAULT 'new',
                    admin_note   TEXT,
                    updated_at   INTEGER
                );
                CREATE INDEX idx_apps_created ON applications(created_at DESC);
                CREATE INDEX idx_apps_status  ON applications(status);
            SQL,
            2 => <<<SQL
                CREATE TABLE login_attempts (
                    ip        TEXT,
                    ts        INTEGER,
                    success   INTEGER
                );
                CREATE INDEX idx_attempts_ip ON login_attempts(ip, ts);
            SQL,
        ];

        foreach ($migrations as $version => $sql) {
            if ($current >= $version) continue;
            $this->pdo->exec('BEGIN');
            try {
                $this->pdo->exec($sql);
                // user_version не поддерживает плейсхолдеры — явный (int) cast как документация.
                $this->pdo->exec('PRAGMA user_version = ' . (int)$version);
                $this->pdo->exec('COMMIT');
            } catch (Throwable $e) {
                $this->pdo->exec('ROLLBACK');
                throw $e;
            }
        }
    }
}

function db(): Db
{
    static $instance = null;
    if ($instance === null) {
        $cfg = $GLOBALS['CONFIG'];
        $instance = new Db($cfg['db_path']);
    }
    return $instance;
}
