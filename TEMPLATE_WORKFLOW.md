# Professional List Template Workflow

This guide explains how to quickly create new professional listing pages using the reusable component templates.

## 🚀 Quick Start

To create a new professional list page (e.g., "Top 10 Lawyers in Phoenix"):

### 1. Prepare Your Assets
```bash
# Add professional photos to appropriate folder
src/assets/lawyers/
  - john-doe.jpg
  - jane-smith.jpg
  # etc...
```

### 2. Create Your Page File
```bash
# Copy the template
cp src/components/TEMPLATE_USAGE_EXAMPLE.tsx src/pages/PhoenixLawyerList.tsx
```

### 3. Update Data & Metadata

Edit `src/pages/PhoenixLawyerList.tsx`:

```typescript
// Import your images
import johnDoeImg from "@/assets/lawyers/john-doe.jpg";

// Define professionals
const professionals: Professional[] = [
  {
    rank: 1,
    name: "John Doe",
    title: "Esq.",
    company: "Doe & Associates",
    rating: 4.9,
    reviews: 234,
    specialties: ["Criminal Defense", "Personal Injury", "Family Law"],
    address: "456 Main St, Phoenix, AZ 85001",
    phone: "(602) 555-0100",
    website: "johndoelaw.com",
    description: "Award-winning attorney with 20 years experience...",
    stats: {
      yearsExperience: 20,
      casesWon: 450,
      successRate: "94%"
    },
    verified: true,
    image: johnDoeImg
  },
  // ... more professionals
];

// Configure metadata
const pageMetadata: PageMetadata = {
  title: "Top 10 Lawyers in Phoenix, Arizona (2025)",
  description: "Discover Phoenix's top-rated lawyers. Verified attorneys with proven case records...",
  breadcrumbs: [
    { name: "Arizona" },
    { name: "Phoenix" },
    { name: "Top Lawyers" }
  ],
  location: {
    city: "Phoenix",
    state: "Arizona",
    stateAbbr: "AZ"
  },
  profession: {
    singular: "Lawyer",
    plural: "Lawyers",
    schemaType: "Attorney"
  }
};
```

### 4. Add Route
Edit `src/App.tsx`:
```typescript
import PhoenixLawyerList from "./pages/PhoenixLawyerList";

// In Routes:
<Route path="/az/phoenix/lawyers" element={<PhoenixLawyerList />} />
```

### 5. Done! 🎉
Your new page is ready with:
- ✅ SEO optimization (meta tags, JSON-LD)
- ✅ Responsive design
- ✅ Arizona color palette
- ✅ Collapsible sections
- ✅ Schema.org markup
- ✅ Breadcrumb navigation

---

## 📁 Component Structure

```
src/
├── types/
│   └── professional.ts          # TypeScript interfaces
├── components/
│   ├── ProfessionalCard.tsx     # Individual professional card
│   ├── CollapsibleListSection.tsx  # Collapsible section wrapper
│   ├── ProfessionalListLayout.tsx  # Full page layout
│   └── TEMPLATE_USAGE_EXAMPLE.tsx  # Usage guide
└── pages/
    ├── GilbertRealtorList.tsx   # Example: Realtors
    ├── SampleDentistList.tsx    # Example: Dentists
    └── YourNewList.tsx          # Your new page
```

## 🎨 Available Accent Colors

Configured in `src/index.css` and `tailwind.config.ts`:

- `primary` - Blue/teal (default)
- `sunset-orange` - Warm orange
- `terracotta` - Reddish brown
- `turquoise` - Bright teal
- `cactus-green` - Desert green
- `desert-sand` - Tan/beige

Use in sections:
```typescript
{
  accentColor: "sunset-orange"  // Changes border, shadows, gradients
}
```

## 📊 Professional Stats Fields

Customize stats based on profession:

**Real Estate Agents:**
```typescript
stats: {
  salesLast12Mo: 128,
  saleToListRatio: "99.26%",
  avgDaysOnMarket: 42,
  yearsExperience: 15
}
```

**Dentists:**
```typescript
stats: {
  yearsExperience: 12,
  patientsServed: 5000,
  successRate: "98%",
  satisfactionScore: "4.9/5"
}
```

**Lawyers:**
```typescript
stats: {
  yearsExperience: 20,
  casesWon: 450,
  successRate: "94%",
  clientReviews: 234
}
```

## 🔧 Customization Options

### Layout Options

**Option 1: Collapsible Sections** (Recommended for 10+ items)
```typescript
const sections: ListSection[] = [
  {
    title: "Established Leaders",
    description: "Proven track records",
    accentColor: "primary",
    items: professionals.slice(0, 5)
  },
  {
    title: "Rising Stars",
    description: "Exceptional service",
    accentColor: "sunset-orange",
    items: professionals.slice(5, 10)
  }
];

return (
  <ProfessionalListLayout metadata={pageMetadata} professionals={professionals}>
    {sections.map((section, index) => (
      <CollapsibleListSection
        key={section.title}
        section={section}
        defaultOpen={index === 0}
        schemaType={pageMetadata.profession.schemaType}
      />
    ))}
  </ProfessionalListLayout>
);
```

**Option 2: Simple List** (For fewer items)
```typescript
return (
  <ProfessionalListLayout metadata={pageMetadata} professionals={professionals}>
    {professionals.map((professional) => (
      <ProfessionalCard 
        key={professional.rank}
        professional={professional}
        schemaType={pageMetadata.profession.schemaType}
      />
    ))}
  </ProfessionalListLayout>
);
```

### Custom Hero Icons
```typescript
<ProfessionalListLayout
  metadata={pageMetadata}
  professionals={professionals}
  heroIcons={[
    { icon: <Scale className="h-5 w-5 text-primary" />, label: "Licensed & Insured" },
    { icon: <Award className="h-5 w-5 text-primary" />, label: "Award Winners" },
    { icon: <Users className="h-5 w-5 text-primary" />, label: "Client Focused" },
  ]}
>
```

## 📱 Schema.org Types

Common profession types for SEO:
- `RealEstateAgent`
- `Dentist`
- `Attorney` (for lawyers)
- `Physician`
- `Accountant`
- `Contractor`
- `Person` (fallback)

Full list: https://schema.org/Person

## ✅ Pre-flight Checklist

Before going live:

- [ ] All professional images optimized (< 200KB each)
- [ ] Phone numbers formatted correctly
- [ ] Website URLs tested (without https://)
- [ ] Addresses include ZIP codes
- [ ] Stats are accurate and up-to-date
- [ ] Page title < 60 characters
- [ ] Meta description < 160 characters
- [ ] Route added to App.tsx
- [ ] Test on mobile and desktop
- [ ] Verify schema markup (Google Rich Results Test)

## 🚀 Performance Tips

1. **Image Optimization**: Use WebP format, max 800x800px
2. **Lazy Loading**: Images automatically lazy-load below fold
3. **Code Splitting**: Each page route code-splits automatically
4. **Minimal Re-renders**: Collapsible state is localized

## 🆘 Troubleshooting

**Problem: Colors not showing**
- Ensure color is in `tailwind.config.ts` and `index.css`
- Check that color name matches exactly (e.g., `sunset-orange` not `sunsetOrange`)

**Problem: Images not loading**
- Verify image import path is correct
- Check image file exists in assets folder
- Ensure image is imported at top of file

**Problem: Schema markup errors**
- Use Google's Rich Results Test
- Verify `schemaType` matches Schema.org documentation
- Check all required fields are populated

## 📚 Additional Resources

- [Schema.org Documentation](https://schema.org/)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Router Docs](https://reactrouter.com/)

---

## 💡 Pro Tips

1. **Consistency**: Use the same stat fields across all professionals of the same type
2. **SEO**: Update page monthly with new reviews/stats to maintain "Updated 2025" badge
3. **Mobile First**: Test on mobile - most users will view on phones
4. **Loading Speed**: Keep total page size under 2MB
5. **Accessibility**: All images have descriptive alt text automatically
