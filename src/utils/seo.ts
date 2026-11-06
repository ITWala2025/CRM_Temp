export interface SEOData {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  structuredData?: Record<string, unknown>;
  noindex?: boolean;
}

export const defaultSEO: SEOData = {
  title: "Kdadks - Multi-Industry Excellence in IT, Healthcare, Fashion & Travel",
  description: "Leading provider of IT consulting & training, healthcare services, fashion solutions, and travel experiences. Serving through IT Wala, Ayuh Clinic, Nirchal, and Raahirides brands.",
  keywords: [
    "IT consulting", "software training", "healthcare services", "fashion tailoring", "travel solutions",
    "product management", "software testing", "AI training", "homeopathic treatment", "custom tailoring",
    "business travel", "Lucknow services", "multi-industry company", "Kdadks", "IT Wala", "Ayuh Clinic", "Nirchal", "Raahirides"
  ],
  ogType: "website",
  twitterCard: "summary_large_image"
};

export const pageSEO = {
  home: {
    title: "Kdadks Service Pvt Ltd - Multi-Industry Excellence | IT, Healthcare, Fashion, Travel",
    description: "Transform your business with Kdadks' diverse expertise. IT consulting & training through IT Wala, healthcare via Ayuh Clinic, fashion with Nirchal, and travel through Raahirides.",
    keywords: ["multi-industry services", "IT consulting", "healthcare services", "fashion solutions", "travel experiences", "Lucknow business", "professional services"],
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Kdadks",
      "alternateName": ["Kdadks", "KDADKS"],
      "url": "https://kdadks.com",
      "logo": "https://kdadks.com/Logo.png",
      "description": "Multi-industry company providing IT consulting, healthcare, fashion, and travel services",
      "founder": {
        "@type": "Person",
        "name": "Kdadks Founder"
      },
      "foundingDate": "2019",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Lucknow",
        "addressRegion": "Uttar Pradesh",
        "addressCountry": "India"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+91-7982303199",
        "contactType": "customer service",
        "email": "kdadks@outlook.com"
      },
      "sameAs": [
        "https://it-wala.com",
        "https://www.ayuhclinic.com",
        "https://nirchal.com",
        "https://raahirides.com"
      ],
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Services",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "IT Consulting & Training",
              "description": "Professional IT consulting, product management, and software development training"
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Healthcare Services",
              "description": "Comprehensive healthcare including homeopathic treatments and wellness programs"
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Fashion & Tailoring",
              "description": "Custom tailoring and fashion design services"
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Travel Solutions",
              "description": "Corporate and leisure travel arrangements, point-to-point transportation"
            }
          }
        ]
      }
    }
  },
  about: {
    title: "About Kdadks - Multi-Industry Leader | Our Vision & Values",
    description: "Learn about Kdadks's journey across IT, healthcare, fashion, and travel industries. Discover our vision, values, and commitment to excellence.",
    keywords: ["about kdadks", "company history", "mission vision", "multi-industry expertise", "core values", "business philosophy"],
    structuredData: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "mainEntity": {
        "@type": "Organization",
        "name": "Kdadks",
        "description": "Multi-industry company with expertise across IT, healthcare, fashion, and travel sectors"
      }
    }
  },
  services: {
    title: "Our Services - IT Consulting, Healthcare, Fashion & Travel | Kdadks",
    description: "Comprehensive services across multiple industries: IT consulting & training, healthcare solutions, custom fashion, and travel arrangements. Expert solutions for all your needs.",
    keywords: ["IT consulting services", "healthcare services", "fashion services", "travel services", "business solutions", "professional training"],
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Service",
      "serviceType": "Multi-Industry Professional Services",
      "provider": {
        "@type": "Organization",
        "name": "Kdadks"
      }
    }
  },
  contact: {
    title: "Contact Kdadks - Get Professional Services | Lucknow, India",
    description: "Contact Kdadks for IT consulting, healthcare, fashion, and travel services. Located in Lucknow, India. Call +91 7982303199 or email kdadks@outlook.com",
    keywords: ["contact kdadks", "business inquiry", "service request", "Lucknow office", "professional consultation"],
    structuredData: {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      "mainEntity": {
        "@type": "Organization",
        "name": "Kdadks",
        "telephone": "+91-7982303199",
        "email": "kdadks@outlook.com",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Lucknow",
          "addressRegion": "Uttar Pradesh", 
          "addressCountry": "India"
        }
      }
    }
  },
  privacy: {
    title: "Privacy Policy - Kdadks",
    description: "Read Kdadks's privacy policy. Learn how we protect your personal information and data across our IT, healthcare, fashion, and travel services.",
    keywords: ["privacy policy", "data protection", "personal information", "GDPR compliance"],
    noindex: false
  },
  terms: {
    title: "Terms & Conditions - Kdadks",
    description: "Terms and conditions for using Kdadks services. Legal terms for IT consulting, healthcare, fashion, and travel services.",
    keywords: ["terms conditions", "legal terms", "service agreement"],
    noindex: false
  }
};

export const generateStructuredData = (type: string, data?: Record<string, unknown>) => {
  const page = pageSEO[type as keyof typeof pageSEO];
  if (page && 'structuredData' in page) {
    return JSON.stringify(page.structuredData);
  }
  
  // Use data parameter for additional context if needed
  if (data) {
    // Could be used for dynamic structured data generation
  }
  
  return null;
};

export const updateMetaTags = (seoData: SEOData) => {
  // Update title
  document.title = seoData.title;
  
  // Update or create meta tags
  const updateMetaTag = (name: string, content: string, property = false) => {
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    let meta = document.querySelector(selector) as HTMLMetaElement;
    
    if (!meta) {
      meta = document.createElement('meta');
      if (property) {
        meta.setAttribute('property', name);
      } else {
        meta.setAttribute('name', name);
      }
      document.head.appendChild(meta);
    }
    meta.content = content;
  };

  // Basic meta tags
  updateMetaTag('description', seoData.description);
  updateMetaTag('keywords', seoData.keywords.join(', '));
  
  // Open Graph tags
  updateMetaTag('og:title', seoData.title, true);
  updateMetaTag('og:description', seoData.description, true);
  updateMetaTag('og:type', seoData.ogType || 'website', true);
  if (seoData.ogImage) {
    updateMetaTag('og:image', seoData.ogImage, true);
  }
  if (seoData.canonicalUrl) {
    updateMetaTag('og:url', seoData.canonicalUrl, true);
  }
  
  // Twitter tags
  updateMetaTag('twitter:card', seoData.twitterCard || 'summary_large_image', true);
  updateMetaTag('twitter:title', seoData.title, true);
  updateMetaTag('twitter:description', seoData.description, true);
  if (seoData.ogImage) {
    updateMetaTag('twitter:image', seoData.ogImage, true);
  }
  
  // Robots
  if (seoData.noindex) {
    updateMetaTag('robots', 'noindex, nofollow');
  } else {
    updateMetaTag('robots', 'index, follow');
  }
  
  // Canonical URL
  if (seoData.canonicalUrl) {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = seoData.canonicalUrl;
  }
  
  // Structured data
  if (seoData.structuredData) {
    let script = document.querySelector('script[type="application/ld+json"]') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(seoData.structuredData);
  }
};