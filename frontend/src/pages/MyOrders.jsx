import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

export default function MyOrders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    client.get('/orders').then((res) => setOrders(res.data.orders));
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h2>My Orders</h2>
        <table>
          <thead>
            <tr><th>ID</th><th>Status</th><th>Total</th><th>Created</th><th></th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.id.slice(0, 8)}</td>
                <td><span className="badge">{o.status}</span></td>
                <td>₹{o.totalCharge}</td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
                <td><Link to={`/orders/${o.id}`}>View</Link></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5}>No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
