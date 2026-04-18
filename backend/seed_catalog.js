const products = [
    {
        name: 'Anggrek Bulan (Phalaenopsis amabilis)',
        description: 'Bunga Nasional Indonesia (Puspa Pesona). Memiliki kelopak lebar berwarna putih bersih dengan corak kuning di tengahnya. Sangat cocok untuk hiasan indoor karena bunganya awet dan perawatannya mudah.',
        price: 150000,
        unit_type: 'PER_POHON',
        stock: 45
    },
    {
        name: 'Anggrek Hitam Kalimantan (Coelogyne pandurata)',
        description: 'Varian sangat langka dan dilindungi. Kelopaknya berwarna hijau cerah dengan lidah (labellum) berwarna hitam pekat. Cocok untuk kolektor tingkat mahir dengan lingkungan tanam terkontrol.',
        price: 850000,
        unit_type: 'PER_POHON',
        stock: 3
    },
    {
        name: 'Anggrek Vanda Tricolor',
        description: 'Spesies epifit endemik Jawa Timur. Bunganya berukuran sedang dengan corak totol-totol merah kecoklatan berlatar putih/kuning. Sangat menyukai sinar matahari yang melimpah dan sirkulasi udara bebas.',
        price: 275000,
        unit_type: 'PER_POHON',
        stock: 12
    },
    {
        name: 'Bibit Dendrobium Spectabile (Botolan)',
        description: 'Bibit anggrek unik keriting. Dijual dalam bentuk botolan kultur jaringan yang steril. Satu botol berisi +- 25 hingga 30 bibit nener ukuran 1-2 cm. Sangat cocok bagi petani anggrek pembibitan (B2B).',
        price: 320000,
        unit_type: 'PER_BATCH',
        stock: 100
    },
    {
        name: 'Anggrek Cattleya "The Queen of Orchids"',
        description: 'Dikenal sebagai ratunya anggrek karena ukuran bunganya yang super besar, elegan, dan wanginya yang luar biasa semerbak harum. Berwarna dominan ungu pink cerah. Membutuhkan intensitas cahaya tinggi.',
        price: 450000,
        unit_type: 'PER_POHON',
        stock: 18
    },
    {
        name: 'Anggrek Tanah (Spathoglottis plicata)',
        description: 'Berbeda dengan anggrek lain yang tumbuh mandiri, spesies ini justru ditanam langsung di tanah gambut. Sangat tangguh terhadap iklim tropis, berbunga lebat warna ungu terang, ideal untuk lanskap taman estetik.',
        price: 85000,
        unit_type: 'PER_POHON',
        stock: 60
    }
];

async function seedData() {
    console.log("Memulai penanaman bibit katalog ke Database...");
    
    for (const p of products) {
        try {
            // 1. Insert Product
            const res = await fetch('http://localhost:8080/api/v1/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    unit_type: p.unit_type
                })
            });
            const d = await res.json();
            
            if (!res.ok) {
                console.error("Gagal nyimpen:", p.name, d);
                continue;
            }

            const productId = d.data.id;
            console.log(`✅ Sukses nambahin list: ${p.name}`);

            // 2. Adjust Stock via Stock Opname Endpoint so it appears normally (Inventory created + logs written)
            await fetch(`http://localhost:8080/api/v1/products/${productId}/adjust-stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantity: p.stock,
                    note: "Stok Pasokan Awal Supplier"
                })
            });
            console.log(`   📦 Stok ${p.stock} item masuk gudang!`);

        } catch (e) {
            console.error("Crash bro:", e.message);
        }
    }
    console.log("SELESAI SEMPURNA! 🎉 Silakan cek katalog browser lo sekarang.");
}

seedData();
