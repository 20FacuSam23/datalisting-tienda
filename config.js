window.DATALISTING_STORE = {
  API_BASE_URL: 'https://datalisting.info',
  PORTAL_SLUG: 'tienda-generica',
  ORGANIZATION_SLUG: 'datalisting',
  PORTALS: {
    nuts: {
      PORTAL_SLUG: 'nuts',
      API_PORTAL_SLUG: 'nutrigo-parana',
      CATALOG_SNAPSHOT: new URL('assets/nuts-catalog.json', document.currentScript.src).href,
      CATALOG_READ_ONLY: false,
      BRAND_NAME: 'Nuts',
      BRAND_INITIAL: 'N',
      BRAND_TAGLINE: 'Productos naturales y dietéticos',
      BRAND_HEADLINE: 'Productos naturales y dietéticos'
    }
  }
};

window.datalistingCatalogText = (value, branded) => branded
  ? String(value ?? '').replace(/\b(?:nutri\s*go|fudo|vibes)\b/gi, '').replace(/[ \t]{2,}/g, ' ').trim()
  : String(value ?? '');
