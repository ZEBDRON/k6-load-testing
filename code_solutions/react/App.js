import "./App.css";
import { useState } from "react";

// Sample product data
const productsData = [
  { name: "Laptop", price: 999, category: "Electronics" },
  { name: "T-shirt", price: 19, category: "Clothing" },
  { name: "Coffee Maker", price: 49, category: "Home" },
  { name: "Smartphone", price: 599, category: "Electronics" },
  { name: "Jacket", price: 89, category: "Clothing" },
];

function App() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", ...new Set(productsData.map((p) => p.category))];

  const filteredProducts =
    selectedCategory === "All"
      ? productsData
      : productsData.filter((p) => p.category === selectedCategory);

  return (
    <div className="App">
      <h1>Product Listing</h1>

      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="category-filter">Filter by Category: </label>
        <select
          id="category-filter"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
        }}
      >
        {filteredProducts.map((product, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "1rem",
              backgroundColor: "#f9f9f9",
            }}
          >
            <h3>{product.name}</h3>
            <p>Price: ₹{product.price}</p>
            <p>Category: {product.category}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
