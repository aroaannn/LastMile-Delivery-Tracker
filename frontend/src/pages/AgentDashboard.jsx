import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const NEXT_STATUS = {
  ASSIGNED: 'PICKED_UP',
  PICKED_UP: 'IN_TRANSIT',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

export default function AgentDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    const res = await client.get('/orders');
    setOrders(res.data.orders);
  }

  useEffect(() => { load(); }, []);

  async function toggleAvailability() {
    const next = !isAvailable;
    await client.patch('/agents/me/availability', { isAvailable: next });
    setIsAvailable(next);
  }

  async function advance(order) {
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;
    try {
      await client.patch(`/orders/${order.id}/status`, { status: nextStatus });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update status');
    }
  }

  async function markFailed(order) {
    const reason = window.prompt('Reason for failed delivery?') || 'Not specified';
    try {
      await client.patch(`/orders/${order.id}/status`, { status: 'FAILED', failureReason: reason });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update status');
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Agent Dashboard</h2>
        <button onClick={toggleAvailability}>
          {isAvailable ? 'Go unavailable' : 'Go available'}
        </button>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="card">
        <h3>My assigned orders</h3>
        <table>
          <thead><tr><th>ID</th><th>Status</th><th>Drop address</th><th>Actions</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/orders/${o.id}`}>{o.id.slice(0, 8)}</Link></td>
                <td><span className="badge">{o.status}</span></td>
                <td>{o.dropAddress}</td>
                <td>
                  {NEXT_STATUS[o.status] && (
                    <button onClick={() => advance(o)}>Mark {NEXT_STATUS[o.status]}</button>
                  )}
                  {['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(o.status) && (
                    <button className="secondary" onClick={() => markFailed(o)} style={{ marginLeft: 6 }}>Mark failed</button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={4}>No orders assigned.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
