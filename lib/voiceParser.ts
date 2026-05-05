// ADDITIVE: Local logic to extract data for FREE
export function parseVoiceCommand(text: string) {
    const lowerText = text.toLowerCase();
    
    // 1. Extract Quantity (Looks for any number)
    const qtyMatch = text.match(/\d+/);
    const quantity = qtyMatch ? parseInt(qtyMatch[0]) : 1;

    // 2. Extract Sizes
    const sizes = ["small", "medium", "large", "xl", "2xl", "3xl", "s", "m", "l"];
    const size = sizes.find(s => lowerText.split(' ').includes(s)) || "Standard";

    // 3. Extract Item Type (Specifically looking for your 18500 code)
    let itemType = "Custom Apparel";
    if (lowerText.includes("18500") || lowerText.includes("hoodie")) {
        itemType = "18500 Heavy Blend Hoodie";
    } else if (lowerText.includes("t-shirt") || lowerText.includes("tee")) {
        itemType = "Standard T-Shirt";
    }

    // 4. Extract Colors (Common ones)
    const colors = ["black", "white", "nardo grey", "gold", "red", "blue", "navy"];
    const color = colors.find(c => lowerText.includes(c)) || "Default Color";

    // 5. Determine Intent
    const intent = (lowerText.includes("order") || lowerText.includes("customer")) ? "order" : "task";

    return {
        intent,
        payload: {
            customer_name: "Voice Entry", // We can refine name extraction later
            item_type: itemType,
            color: color,
            size: size.toUpperCase(),
            quantity: quantity,
            status: "Pending",
            description: text // Saves the full transcript just in case
        }
    };
}