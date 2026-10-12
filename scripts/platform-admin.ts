/*
 * Grant or revoke platform (super) admin. Deliberately not possible from the
 * website, so nobody can promote themselves.
 *
 *   npm run admin:grant -- someone@company.com
 *   npm run admin:grant -- someone@company.com --revoke
 */
import postgres from "postgres";

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email || !email.includes("@")) throw new Error("Usage: npm run admin:grant -- <email> [--revoke]");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const grant = flag !== "--revoke";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('app.system', 'on', true)`;
      return tx<{ email: string }[]>`update users set is_platform_admin = ${grant} where email = ${email.toLowerCase()} returning email`;
    });
    if (!rows.length) throw new Error(`No account found for ${email}. Sign up first, then run this again.`);
    console.log(`${rows[0].email} is ${grant ? "now" : "no longer"} a platform admin.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
