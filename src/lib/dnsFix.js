// Some networks (and some Windows setups) cannot resolve the DNS "SRV" records that
// mongodb+srv:// connection strings need, and Node then fails with `querySrv ECONNREFUSED`.
// When that happens we retry once using public DNS servers. Harmless everywhere else.
import dns from 'node:dns';

export async function withDnsFallback(connect) {
  try {
    return await connect();
  } catch (err) {
    const msg = String(err?.message || '');
    if (/querySrv|ENOTFOUND|ECONNREFUSED/.test(msg) && /_mongodb\._tcp|querySrv/.test(msg)) {
      const servers = (process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(',').map((s) => s.trim()).filter(Boolean);
      dns.setServers(servers);
      return connect();
    }
    throw err;
  }
}
