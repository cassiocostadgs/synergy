-- Login com SSO da Microsoft (Entra ID). O provisionamento segue manual: esta
-- coluna apenas amarra um cadastro existente à conta do Entra.

-- O claim `oid` do Entra identifica a pessoa dentro do tenant e não muda quando
-- o e-mail é renomeado. Guardá-lo evita o caso em que um endereço liberado por
-- quem saiu é reaproveitado e a nova pessoa herda o cadastro antigo.
ALTER TABLE users ADD COLUMN microsoft_oid text;

-- UNIQUE já resolve: no PostgreSQL vários NULL não conflitam entre si, então
-- quem nunca entrou por SSO fica de fora da restrição sem precisar de índice
-- parcial. A garantia é que duas contas do Synergy não podem apontar para a
-- mesma pessoa no Entra.
ALTER TABLE users ADD CONSTRAINT users_microsoft_oid_key UNIQUE (microsoft_oid);
