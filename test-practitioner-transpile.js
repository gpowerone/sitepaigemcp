const { transpileCode } = require('./transpiler/transpiler.cjs');

// The practitioner display code from the user
const practitionerCode = `function PractitionersDisplay() {
  const [practitioners, setPractitioners] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [filterSpecialization, setFilterSpecialization] = React.useState('');
  const [filterAvailable, setFilterAvailable] = React.useState('');
  const [filterMinExperience, setFilterMinExperience] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [unauthorized, setUnauthorized] = React.useState(false);

  const fetchPractitioners = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSpecialization) params.append('specialization', filterSpecialization);
      if (filterAvailable) params.append('available', filterAvailable);
      if (filterMinExperience) params.append('min_experience', filterMinExperience);
      params.append('page', currentPage.toString());
      params.append('limit', '12');

      const response = await window.fetchTest(\`/api/practitionerslist?\${params.toString()}\`);
      
      if (response.status === 401) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch practitioners');
      }

      const result = await response.json();
      setPractitioners(result.data || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalpages || 1);
      setUnauthorized(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterSpecialization, filterAvailable, filterMinExperience, currentPage]);

  React.useEffect(() => {
    fetchPractitioners();
  }, [fetchPractitioners]);

  const handlePractitionerClick = (practitionerId) => {
    window.postMessage({ 
      navigate: "practitioner_detail", 
      ids: [{"practitionersid": practitionerId}] 
    });
  };

  const handleFilterChange = (filterType, value) => {
    setCurrentPage(1);
    if (filterType === 'specialization') {
      setFilterSpecialization(value);
    } else if (filterType === 'available') {
      setFilterAvailable(value);
    } else if (filterType === 'min_experience') {
      setFilterMinExperience(value);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  if (loading) {
    return React.createElement('div', {
      className: 'w-full h-full flex items-center justify-center'
    }, window.processText("loading_practitioners"));
  }

  if (error) {
    return React.createElement('div', {
      className: 'w-full h-full flex items-center justify-center'
    }, window.processText("error_loading"));
  }

  if (unauthorized) {
    return React.createElement('div', {
      className: 'w-full h-full flex items-center justify-center'
    }, window.processText("unauthorized_access"));
  }

  return React.createElement('div', {
    className: 'w-full h-full p-4 sm:p-6 lg:p-8'
  }, [
    // Test the template literal issue
    React.createElement('img', {
      src: \`data:image/jpeg;base64,\${practitioners[0]?.profile_image || ''}\`,
      alt: 'Test Profile'
    }),
    // Test window.processText
    React.createElement('h1', {}, window.processText("test_title")),
    React.createElement('p', {}, window.processText("test_text", "Default text"))
  ]);
}`;

// Test dictionary
const dictionary = {
  "loading_practitioners": "Loading practitioners...",
  "error_loading": "Error loading practitioners",
  "unauthorized_access": "Unauthorized access",
  "test_title": "Test Title",
  "test_text": "Test Text Content",
  "practitioners_title": "Our Practitioners",
  "practitioners_subtitle": "Find the perfect practitioner for your needs"
};

// Test pages
const pages = [
  { id: "practitioner_detail", name: "practitioner-detail" },
  { id: "practitioner_profile", name: "practitioner-profile" }
];

console.log("=== Testing Practitioner Display Code Transpilation ===\n");

try {
  const result = JSON.parse(transpileCode(practitionerCode, pages, dictionary));
  
  if (result.success) {
    console.log("✅ Transpilation successful!\n");
    console.log("Transpiled code:");
    console.log("================");
    console.log(result.code);
    console.log("================\n");
    
    // Check for specific issues
    console.log("Checking for issues:");
    
    // 1. Check if dictionary values are preserved
    if (result.code.includes('"Loading practitioners..."')) {
      console.log("✅ Dictionary values are properly inserted");
    } else {
      console.log("❌ Dictionary values are missing");
    }
    
    // 2. Check if template literal is preserved
    if (result.code.includes('data:image/jpeg;base64,')) {
      console.log("✅ Template literal static parts are preserved");
    } else {
      console.log("❌ Template literal static parts are missing");
    }
    
    // 3. Check if navigation is correct
    if (result.code.includes('/practitioner_detail')) {
      console.log("✅ Page navigation uses correct page name");
    } else {
      console.log("❌ Page navigation is incorrect");
    }
    
  } else {
    console.log("❌ Transpilation failed!");
    console.log("Error:", result.error);
  }
} catch (error) {
  console.log("❌ Exception during transpilation!");
  console.log("Error:", error);
}
