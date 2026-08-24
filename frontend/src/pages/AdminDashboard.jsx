import { useEffect, useState } from 'react';
import client from '../api/client';

const TABS = ['Orders', 'Zones & Areas', 'Rate Cards', 'Agents'];

export default function AdminDashboard() {
  const [tab, setTab] = useState('Orders');
  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {TABS.map((t) => (
            <button key={t} className={tab === t ? '' : 'secondary'} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        {tab === 'Orders' && <OrdersTab />}
        {tab === 'Zones & Areas' && <ZonesTab />}
        {tab === 'Rate Cards' && <RateCardsTab />}
        {tab === 'Agents' && <AgentsTab />}
      </div>
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [filters, setFilters] = useState({ status: '', zoneId: '', agentId: '' });
  const [error, setError] = useState('');

  async function load() {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const res = await client.get('/orders', { params });
    setOrders(res.data.orders);
  }

  useEffect(() => {
    load();
    client.get('/agents').then((res) => setAgents(res.data.agents));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function assign(orderId, agentId) {
    if (!agentId) return;
    try {
      await client.patch(`/orders/${orderId}/assign`, { agentId });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Assignment failed');
    }
  }

  async function override(orderId, status) {
    try {
      await client.patch(`/orders/${orderId}/status`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Override failed');
    }
  }

  const STATUSES = ['CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RESCHEDULED'];

  return (
    <div>
      <h3>All Orders</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.agentId} onChange={(e) => setFilters((f) => ({ ...f, agentId: e.target.value }))}>
          <option value="">All agents</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      {error && <div className="error">{error}</div>}
      <table>
        <thead><tr><th>ID</th><th>Status</th><th>Customer</th><th>Agent</th><th>Assign</th><th>Override</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id.slice(0, 8)}</td>
              <td><span className="badge">{o.status}</span></td>
              <td>{o.customer?.name}</td>
              <td>{o.agent?.name || '—'}</td>
              <td>
                <select defaultValue="" onChange={(e) => assign(o.id, e.target.value)}>
                  <option value="">Assign agent...</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name} {a.isAvailable ? '' : '(busy)'}</option>)}
                </select>
              </td>
              <td>
                <select defaultValue="" onChange={(e) => e.target.value && override(o.id, e.target.value)}>
                  <option value="">Override...</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ZonesTab() {
  const [zones, setZones] = useState([]);
  const [areas, setAreas] = useState([]);
  const [zoneForm, setZoneForm] = useState({ name: '', code: '' });
  const [areaForm, setAreaForm] = useState({ name: '', pincode: '', zoneId: '' });

  async function load() {
    const [z, a] = await Promise.all([client.get('/zones'), client.get('/areas')]);
    setZones(z.data.zones);
    setAreas(a.data.areas);
  }
  useEffect(() => { load(); }, []);

  async function createZone(e) {
    e.preventDefault();
    await client.post('/zones', zoneForm);
    setZoneForm({ name: '', code: '' });
    load();
  }
  async function createArea(e) {
    e.preventDefault();
    await client.post('/areas', areaForm);
    setAreaForm({ name: '', pincode: '', zoneId: '' });
    load();
  }

  return (
    <div>
      <h3>Zones</h3>
      <form onSubmit={createZone} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input placeholder="Zone name" value={zoneForm.name} onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))} required />
        <input placeholder="Code (e.g. WEST)" value={zoneForm.code} onChange={(e) => setZoneForm((f) => ({ ...f, code: e.target.value }))} required />
        <button type="submit">Add zone</button>
      </form>
      <ul>{zones.map((z) => <li key={z.id}>{z.name} ({z.code}) — {z.areas.length} area(s)</li>)}</ul>

      <h3>Areas (pincode → zone mapping)</h3>
      <form onSubmit={createArea} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input placeholder="Area name" value={areaForm.name} onChange={(e) => setAreaForm((f) => ({ ...f, name: e.target.value }))} required />
        <input placeholder="Pincode" value={areaForm.pincode} onChange={(e) => setAreaForm((f) => ({ ...f, pincode: e.target.value }))} required />
        <select value={areaForm.zoneId} onChange={(e) => setAreaForm((f) => ({ ...f, zoneId: e.target.value }))} required>
          <option value="">Zone</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <button type="submit">Add area</button>
      </form>
      <ul>{areas.map((a) => <li key={a.id}>{a.name} ({a.pincode}) — {a.zone.name}</li>)}</ul>
    </div>
  );
}

function RateCardsTab() {
  const [zones, setZones] = useState([]);
  const [rateCards, setRateCards] = useState([]);
  const [codConfigs, setCodConfigs] = useState([]);
  const [rcForm, setRcForm] = useState({ orderType: 'B2C', zoneRelation: 'INTRA', baseCharge: '', perKgRate: '' });
  const [codForm, setCodForm] = useState({ orderType: 'B2C', surchargeType: 'FLAT', value: '' });

  async function load() {
    const [z, rc, cc] = await Promise.all([
      client.get('/zones'), client.get('/rate-cards'), client.get('/cod-config'),
    ]);
    setZones(z.data.zones);
    setRateCards(rc.data.rateCards);
    setCodConfigs(cc.data.codConfigs);
  }
  useEffect(() => { load(); }, []);

  async function saveRateCard(e) {
    e.preventDefault();
    await client.post('/rate-cards', rcForm);
    load();
  }
  async function saveCodConfig(e) {
    e.preventDefault();
    await client.post('/cod-config', codForm);
    load();
  }

  return (
    <div>
      <h3>Rate Cards (default, per orderType + zone relation)</h3>
      <form onSubmit={saveRateCard} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={rcForm.orderType} onChange={(e) => setRcForm((f) => ({ ...f, orderType: e.target.value }))}>
          <option value="B2C">B2C</option><option value="B2B">B2B</option>
        </select>
        <select value={rcForm.zoneRelation} onChange={(e) => setRcForm((f) => ({ ...f, zoneRelation: e.target.value }))}>
          <option value="INTRA">Intra-zone</option><option value="INTER">Inter-zone</option>
        </select>
        <input type="number" step="0.01" placeholder="Base charge" value={rcForm.baseCharge} onChange={(e) => setRcForm((f) => ({ ...f, baseCharge: e.target.value }))} required />
        <input type="number" step="0.01" placeholder="Per kg rate" value={rcForm.perKgRate} onChange={(e) => setRcForm((f) => ({ ...f, perKgRate: e.target.value }))} required />
        <button type="submit">Save rate card</button>
      </form>
      <table>
        <thead><tr><th>Order type</th><th>Relation</th><th>Base</th><th>Per kg</th></tr></thead>
        <tbody>
          {rateCards.map((r) => (
            <tr key={r.id}><td>{r.orderType}</td><td>{r.zoneRelation}</td><td>₹{r.baseCharge}</td><td>₹{r.perKgRate}</td></tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 24 }}>COD Surcharge Config</h3>
      <form onSubmit={saveCodConfig} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={codForm.orderType} onChange={(e) => setCodForm((f) => ({ ...f, orderType: e.target.value }))}>
          <option value="B2C">B2C</option><option value="B2B">B2B</option>
        </select>
        <select value={codForm.surchargeType} onChange={(e) => setCodForm((f) => ({ ...f, surchargeType: e.target.value }))}>
          <option value="FLAT">Flat ₹</option><option value="PERCENT">Percent %</option>
        </select>
        <input type="number" step="0.01" placeholder="Value" value={codForm.value} onChange={(e) => setCodForm((f) => ({ ...f, value: e.target.value }))} required />
        <button type="submit">Save COD config</button>
      </form>
      <table>
        <thead><tr><th>Order type</th><th>Type</th><th>Value</th></tr></thead>
        <tbody>
          {codConfigs.map((c) => (
            <tr key={c.id}><td>{c.orderType}</td><td>{c.surchargeType}</td><td>{c.value}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentsTab() {
  const [agents, setAgents] = useState([]);
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', homeZoneId: '' });

  async function load() {
    const [a, z] = await Promise.all([client.get('/agents'), client.get('/zones')]);
    setAgents(a.data.agents);
    setZones(z.data.zones);
  }
  useEffect(() => { load(); }, []);

  async function createAgent(e) {
    e.preventDefault();
    await client.post('/admin/users', { ...form, role: 'AGENT' });
    setForm({ name: '', email: '', password: '', homeZoneId: '' });
    load();
  }

  return (
    <div>
      <h3>Create Delivery Agent</h3>
      <form onSubmit={createAgent} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
        <select value={form.homeZoneId} onChange={(e) => setForm((f) => ({ ...f, homeZoneId: e.target.value }))}>
          <option value="">Home zone</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <button type="submit">Create agent</button>
      </form>

      <h3>Agents</h3>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Home zone</th><th>Available</th></tr></thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id}><td>{a.name}</td><td>{a.email}</td><td>{a.homeZone?.name || '—'}</td><td>{a.isAvailable ? 'Yes' : 'No'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
