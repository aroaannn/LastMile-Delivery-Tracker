import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

const initialForm = {
  pickupAddress: '',
  pickupAreaId: '',
  dropAddress: '',
  dropAreaId: '',
  lengthCm: '',
  breadthCm: '',
  heightCm: '',
  actualWeightKg: '',
  orderType: 'B2C',
  paymentType: 'PREPAID',
};

export default function PlaceOrder() {
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    client.get('/areas').then((res) => setAreas(res.data.areas));
  }, []);

  function update(field) {
    return (e) => {
      setQuote(null);
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function getQuote(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await client.post('/orders/quote', form);
      setQuote(res.data.quote);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not calculate a quote');
    }
  }

  async function confirmOrder() {
    setSubmitting(true);
    setError('');
    try {
      const res = await client.post('/orders', form);
      navigate(`/orders/${res.data.order.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create order');
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 600 }}>
      <div className="card">
        <h2>Place an Order</h2>
        <form onSubmit={getQuote}>
          <label><span>Pickup address</span>
            <input value={form.pickupAddress} onChange={update('pickupAddress')} required style={{ width: '100%' }} />
          </label>
          <label><span>Pickup area / pincode</span>
            <select value={form.pickupAreaId} onChange={update('pickupAreaId')} required style={{ width: '100%' }}>
              <option value="">Select area</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.pincode}) - {a.zone.name}</option>)}
            </select>
          </label>

          <label><span>Drop address</span>
            <input value={form.dropAddress} onChange={update('dropAddress')} required style={{ width: '100%' }} />
          </label>
          <label><span>Drop area / pincode</span>
            <select value={form.dropAreaId} onChange={update('dropAreaId')} required style={{ width: '100%' }}>
              <option value="">Select area</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.pincode}) - {a.zone.name}</option>)}
            </select>
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1 }}><span>Length (cm)</span><input type="number" step="0.1" value={form.lengthCm} onChange={update('lengthCm')} required style={{ width: '100%' }} /></label>
            <label style={{ flex: 1 }}><span>Breadth (cm)</span><input type="number" step="0.1" value={form.breadthCm} onChange={update('breadthCm')} required style={{ width: '100%' }} /></label>
            <label style={{ flex: 1 }}><span>Height (cm)</span><input type="number" step="0.1" value={form.heightCm} onChange={update('heightCm')} required style={{ width: '100%' }} /></label>
          </div>
          <label><span>Actual weight (kg)</span>
            <input type="number" step="0.01" value={form.actualWeightKg} onChange={update('actualWeightKg')} required style={{ width: '100%' }} />
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1 }}><span>Order type</span>
              <select value={form.orderType} onChange={update('orderType')} style={{ width: '100%' }}>
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
              </select>
            </label>
            <label style={{ flex: 1 }}><span>Payment type</span>
              <select value={form.paymentType} onChange={update('paymentType')} style={{ width: '100%' }}>
                <option value="PREPAID">Prepaid</option>
                <option value="COD">COD</option>
              </select>
            </label>
          </div>

          {error && <div className="error">{error}</div>}
          <button type="submit">Get quote</button>
        </form>

        {quote && (
          <div className="card" style={{ background: '#f0f4ff', marginTop: 16 }}>
            <h3>Charge breakdown</h3>
            <p>Zone relation: <span className="badge">{quote.zoneRelation}</span></p>
            <p>Volumetric weight: {quote.volumetricWeightKg} kg</p>
            <p>Chargeable weight (higher of actual/volumetric): {quote.chargeableWeightKg} kg</p>
            <p>Base charge: ₹{quote.baseCharge}</p>
            <p>COD surcharge: ₹{quote.codSurcharge}</p>
            <p><strong>Total: ₹{quote.totalCharge}</strong></p>
            <button onClick={confirmOrder} disabled={submitting}>
              {submitting ? 'Placing order...' : 'Confirm & place order'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
