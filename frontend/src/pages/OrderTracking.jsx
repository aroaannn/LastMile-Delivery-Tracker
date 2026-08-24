import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function OrderTracking() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [newDate, setNewDate] = useState('');

  async function load() {
    try {
      const res = await client.get(`/orders/${id}`);
      setOrder(res.data.order);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load order');
    }
  }

  useEffect(() => { load(); }, [id]);

  async function reschedule(e) {
    e.preventDefault();
    try {
      await client.post(`/orders/${id}/reschedule`, { newDate });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reschedule');
    }
  }

  if (error) return <div className="container error">{error}</div>;
  if (!order) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <div className="card">
        <h2>Order {order.id.slice(0, 8)}</h2>
        <p>Status: <span className="badge">{order.status}</span></p>
        <p>From: {order.pickupAddress} ({order.pickupZone?.name})</p>
        <p>To: {order.dropAddress} ({order.dropZone?.name})</p>
        <p>Chargeable weight: {order.chargeableWeightKg} kg | Total: ₹{order.totalCharge}</p>
        {order.agent && <p>Agent: {order.agent.name} ({order.agent.phone || 'no phone on file'})</p>}

        {order.status === 'FAILED' && user?.role === 'CUSTOMER' && (
          <form onSubmit={reschedule} style={{ marginTop: 12 }}>
            <label><span>Reschedule for</span>
              <input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
            </label>
            <button type="submit">Reschedule delivery</button>
          </form>
        )}
      </div>

      <div className="card">
        <h3>Tracking timeline</h3>
        <ul className="timeline">
          {order.statusHistory?.map((h) => (
            <li key={h.id}>
              <strong>{h.status}</strong> — {new Date(h.createdAt).toLocaleString()}
              {h.note && <div style={{ color: '#666' }}>{h.note}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
