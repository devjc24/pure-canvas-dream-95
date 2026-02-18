-- Tabela para registrar trades em processamento
CREATE TABLE IF NOT EXISTS trades_processando (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  crypto_symbol VARCHAR(20) NOT NULL,
  valor_compra DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processando',
  sinal_id INT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (sinal_id) REFERENCES sinais(id)
) ENGINE=InnoDB;
