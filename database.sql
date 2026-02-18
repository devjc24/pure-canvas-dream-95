-- Estrutura do banco de dados para login, permissoes e sessoes.

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  cpf VARCHAR(11) NOT NULL,
  telefone VARCHAR(20) NULL,
  senha_hash VARCHAR(255) NOT NULL,
  referral_code VARCHAR(20) NOT NULL UNIQUE,
  referred_by INT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  twofa_enabled TINYINT NOT NULL DEFAULT 0,
  twofa_secret VARCHAR(64) NULL,
  twofa_temp_secret VARCHAR(64) NULL,
  twofa_updated_at DATETIME NULL,
  ultimo_login DATETIME,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_referred_by
  FOREIGN KEY (referred_by) REFERENCES usuarios(id);

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL UNIQUE,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE usuarios_dados_bancarios (
  usuario_id INT PRIMARY KEY,
  pix_key_type VARCHAR(30) NULL,
  pix_key VARCHAR(120) NULL,
  bank_name VARCHAR(80) NULL,
  bank_agency VARCHAR(20) NULL,
  bank_account VARCHAR(30) NULL,
  bank_account_type VARCHAR(20) NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE permissoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chave VARCHAR(100) NOT NULL UNIQUE,
  descricao VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE usuario_roles (
  usuario_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  PRIMARY KEY (usuario_id, role_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE role_permissoes (
  role_id INTEGER NOT NULL,
  permissao_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permissao_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permissao_id) REFERENCES permissoes(id)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id VARCHAR(80) NULL,
  metadata JSON NULL,
  ip_address VARCHAR(120) NULL,
  user_agent VARCHAR(200) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  sinal_id INT NULL,
  crypto_id VARCHAR(60) NULL,
  crypto_symbol VARCHAR(20) NULL,
  crypto_icon_url VARCHAR(255) NULL,
  current_price DECIMAL(16,8) NULL,
  expected_gain_pct DECIMAL(6,2) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE user_notifications (
  user_id INT NOT NULL,
  notification_id INT NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, notification_id),
  FOREIGN KEY (user_id) REFERENCES usuarios(id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id)
) ENGINE=InnoDB;

CREATE TABLE notification_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  crypto_id VARCHAR(60) NULL,
  crypto_symbol VARCHAR(20) NULL,
  expected_gain_pct DECIMAL(6,2) NULL,
  current_price DECIMAL(16,8) NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NULL,
  interval_minutes INT NOT NULL DEFAULT 1440,
  last_sent_at DATETIME NULL,
  active TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE sessoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expira_em DATETIME NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE saldos (
  usuario_id INT PRIMARY KEY,
  saldo_disponivel DECIMAL(12,2) NOT NULL DEFAULT 0,
  saldo_bloqueado DECIMAL(12,2) NOT NULL DEFAULT 0,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Histórico de saldo diário por usuário
CREATE TABLE saldos_historico (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  saldo DECIMAL(12,2) NOT NULL,
  data_ref DATE NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_usuario_data (usuario_id, data_ref),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE settings (
  chave VARCHAR(80) PRIMARY KEY,
  valor TEXT,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE coingecko_cache (
  chave VARCHAR(160) PRIMARY KEY,
  payload LONGTEXT NOT NULL,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE transacoes_pix (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL,
  valor_bruto DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_liquido DECIMAL(12,2) NOT NULL DEFAULT 0,
  id_transaction VARCHAR(80),
  external_reference VARCHAR(120),
  id_local VARCHAR(64),
  payment_code TEXT,
  payment_code_base64 TEXT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE referral_commissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT NOT NULL,
  referred_id INT NOT NULL,
  transaction_id INT NULL,
  deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'PAID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES usuarios(id),
  FOREIGN KEY (referred_id) REFERENCES usuarios(id),
  FOREIGN KEY (transaction_id) REFERENCES transacoes_pix(id)
) ENGINE=InnoDB;

CREATE TABLE referral_balances (
  usuario_id INT PRIMARY KEY,
  saldo_disponivel DECIMAL(12,2) NOT NULL DEFAULT 0,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE referral_withdrawals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  valor DECIMAL(12,2) NOT NULL DEFAULT 0,
  pix_key VARCHAR(120) NULL,
  pix_type VARCHAR(30) NULL,
  beneficiary_name VARCHAR(120) NULL,
  beneficiary_document VARCHAR(20) NULL,
  id_transaction VARCHAR(80) NULL,
  external_reference VARCHAR(120) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE depositos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'deposit',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Tabela de sinais para registrar oportunidades de lucro
CREATE TABLE sinais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  crypto_symbol VARCHAR(20) NOT NULL,
  horario_inicio DATETIME NOT NULL,
  horario_fim DATETIME NOT NULL,
  lucro_percentual DECIMAL(5,2) NOT NULL, -- Ex: 10.00 para 10%
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabela de trades (apenas compra, com lucro/prejuízo)
DROP TABLE IF EXISTS trades;
CREATE TABLE trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  crypto_symbol VARCHAR(20) NOT NULL,
  quantidade DECIMAL(18,8) NOT NULL,
  preco_unitario DECIMAL(18,8) NOT NULL,
  valor_total DECIMAL(18,8) NOT NULL,
  sinal_id INT NULL,
  lucro DECIMAL(12,2) DEFAULT 0,
  prejuizo DECIMAL(12,2) DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (sinal_id) REFERENCES sinais(id)
) ENGINE=InnoDB;

CREATE INDEX idx_usuarios_referred_by ON usuarios(referred_by);
CREATE INDEX idx_depositos_usuario ON depositos(usuario_id);
CREATE UNIQUE INDEX idx_referral_commissions_referred ON referral_commissions(referred_id);
CREATE INDEX idx_referral_commissions_referrer ON referral_commissions(referrer_id);

CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);
CREATE INDEX idx_transacoes_usuario ON transacoes_pix(usuario_id);
CREATE UNIQUE INDEX idx_transacoes_id_transaction ON transacoes_pix(id_transaction);
CREATE UNIQUE INDEX idx_transacoes_id_local ON transacoes_pix(id_local);

-- Dados basicos
INSERT INTO roles (nome) VALUES ('admin'), ('user');
INSERT INTO permissoes (chave, descricao) VALUES
  ('dashboard.view', 'Acessar dashboard'),
  ('crypto.view', 'Acessar criptomoedas'),
  ('wallet.view', 'Acessar carteira'),
  ('reports.view', 'Acessar relatorios'),
  ('profile.view', 'Acessar perfil'),
  ('admin.summary.view', 'Ver resumo administrativo'),
  ('admin.users.view', 'Listar usuarios administrativos'),
  ('admin.users.edit', 'Editar usuarios administrativos'),
  ('admin.transactions.view', 'Listar transacoes administrativas'),
  ('admin.settings.view', 'Ver configuracoes administrativas'),
  ('admin.settings.edit', 'Editar configuracoes administrativas'),
  ('admin.affiliates.view', 'Listar afiliados administrativos'),
  ('admin.reports.view', 'Ver relatorios administrativos'),
  ('admin.notifications.view', 'Ver notificacoes administrativas'),
  ('admin.notifications.manage', 'Gerenciar notificacoes administrativas');

INSERT INTO role_permissoes (role_id, permissao_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissoes p
WHERE r.nome = 'admin';

INSERT INTO role_permissoes (role_id, permissao_id)
SELECT r.id, p.id
FROM roles r
JOIN permissoes p ON p.chave = 'admin.reports.view'
WHERE r.nome = 'admin';

INSERT INTO role_permissoes (role_id, permissao_id)
SELECT r.id, p.id
FROM roles r
JOIN permissoes p ON p.chave IN ('admin.notifications.view','admin.notifications.manage')
WHERE r.nome = 'admin';

INSERT INTO role_permissoes (role_id, permissao_id)
SELECT r.id, p.id
FROM roles r
JOIN permissoes p ON p.chave IN ('dashboard.view','crypto.view','wallet.view','profile.view')
WHERE r.nome = 'user';

-- Usuario admin padrao (substitua pela senha com hash seguro)
INSERT INTO usuarios (nome, email, cpf, senha_hash, referral_code)
VALUES ('Administrador', 'admin@email.com', '00000000000', 'HASH_AQUI', 'ADMIN');

INSERT INTO usuario_roles (usuario_id, role_id)
SELECT u.id, r.id
FROM usuarios u
JOIN roles r ON r.nome = 'admin'
WHERE u.email = 'admin@email.com';

-- Inserts fictícios para teste (usuário id 5)
INSERT INTO sinais (crypto_symbol, horario_inicio, horario_fim, lucro_percentual)
VALUES ('btc', '2026-02-13 10:00:00', '2026-02-13 11:00:00', 15.00);

-- Compra dentro do sinal (lucro)
INSERT INTO trades (usuario_id, crypto_symbol, quantidade, preco_unitario, valor_total, sinal_id, lucro, criado_em)
VALUES (5, 'btc', 0.01, 350000, 3500, 1, 525, '2026-02-13 10:30:00');

-- Compra fora do sinal (prejuízo)
INSERT INTO trades (usuario_id, crypto_symbol, quantidade, preco_unitario, valor_total, sinal_id, prejuizo, criado_em)
VALUES (5, 'btc', 0.01, 350000, 3500, NULL, 350, '2026-02-13 12:00:00');