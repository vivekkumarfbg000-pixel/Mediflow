const fs = require('fs');
let content = fs.readFileSync('C:\\Users\\vivek\\OneDrive\\Desktop\\Mediflow ecosystem\\frontend\\src\\App.tsx', 'utf8');

// Find and replace the old early return block with the new conditional rendering
const oldBlock = `  // Public route interceptor for payment portal and legal policy compliance pages (/terms, /privacy, /refund-policy, /contact-us)
  if (typeof window !== 'undefined') {
    const pathName = window.location.pathname.toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);
    if (pathName.startsWith('/pay') || (searchParams.has('inv') && !searchParams.has('tab'))) {
      return <WhatsAppPaymentPage />;
    }
    if (
      pathName.startsWith('/terms') || 
      pathName.startsWith('/privacy') || 
      pathName.startsWith('/refund') || 
      pathName.startsWith('/cancellation') || 
      pathName.startsWith('/contact')
    ) {
      return <LegalPoliciesPage />;
    }
  }

  useEffect(() => {`;

const newBlock = `}, []);

  // Render public pages without running the rest of the app logic
  if (publicPage === 'payment') {
    return <WhatsAppPaymentPage />;
  }
  if (publicPage === 'legal') {
    return <LegalPoliciesPage />;
  }

  useEffect(() => {`;

if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync('C:\\Users\\vivek\\OneDrive\\Desktop\\Mediflow ecosystem\\frontend\\src\\App.tsx', content);
    console.log('Replacement successful!');
} else {
    console.log('Old block not found exactly, trying flexible match...');
    // Try regex match
    const regex = /\s*\/\/\s*Public route interceptor[\s\S]*?useEffect\(\(\) => \{/;
    const match = content.match(regex);
    if (match) {
        console.log('Found with regex, length:', match[0].length);
        content = content.replace(match[0], newBlock);
        fs.writeFileSync('C:\\Users\\vivek\\OneDrive\\Desktop\\Mediflow ecosystem\\frontend\\src\\App.tsx', content);
        console.log('Replacement with regex successful!');
    } else {
        console.log('Regex also failed');
    }
}