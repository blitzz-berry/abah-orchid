fetch('http://localhost:8080/api/v1/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'Anggrek Bulan Putih (Premium)',
        description: 'Bunga anggrek bulan siap kembang. Akar sehat dan kelembaban terjaga.',
        price: 150000,
        unit_type: 'PER_POHON'
    })
})
.then(r => r.json())
.then(d => {
    fetch(`http://localhost:8080/api/v1/products/${d.data?.id || d.id}/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 50, note: "Stok awal" })
    });
})
.then(() => console.log('Seeded product!'))
.catch(console.error);
