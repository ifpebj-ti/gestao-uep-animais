// Aceita @ifpe.edu.br e qualquer subdomínio (ex.: @discente.ifpe.edu.br).
// Âncora no "@" e no fim da string: "fulano@ifpe.edu.br.golpe.com" e
// "fulano@naoifpe.edu.br" NÃO passam.
const EMAIL_IFPE = /@(?:[a-z0-9-]+\.)*ifpe\.edu\.br$/;

export function isEmailInstitucional(email) {
  return typeof email === "string" && EMAIL_IFPE.test(email.trim().toLowerCase());
}
