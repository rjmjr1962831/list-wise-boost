# CopyableLink Component - Usage Examples

## Import

```typescript
import { CopyableLink, CopyableText } from '@/components/ui/copyable-link';
```

## Examples

### 1. Admin Testing URLs (default variant)

```typescript
<CopyableLink 
  url="https://staging.top10lists.us/profile/abc123/select-neighborhoods"
  label="Neighborhood Selection Page"
  showOpenButton={true}
/>
```

**When to use:** Admin dashboards, testing tools, any place with full-width space

### 2. Compact Lists (compact variant)

```typescript
<div className="space-y-2">
  {links.map(link => (
    <CopyableLink 
      key={link.id}
      url={link.url}
      label={link.title}
      variant="compact"
      showOpenButton={true}
    />
  ))}
</div>
```

**When to use:** Tables, tight layouts, sidebars

### 3. Inline in Text (inline variant)

```typescript
<p>
  Test the funnel at <CopyableLink url="https://example.com" variant="inline" />
</p>
```

**When to use:** Documentation, help text, inline references

### 4. Verification Tokens (CopyableText)

```typescript
<CopyableText 
  text="abc-123-def-456-ghi-789"
  label="API Key"
  masked={true}
/>
```

**Displays as:** `abc-123...hi-789` with full text copied

**When to use:** Tokens, API keys, secret values, long IDs

### 5. Profile URLs

```typescript
<CopyableLink 
  url={`${window.location.origin}/profile/${agent.slug}`}
  label="Agent Profile URL"
  showOpenButton={false}
/>
```

**When to use:** Sharing links, agent dashboards

### 6. Simple URLs (no open button)

```typescript
<CopyableLink 
  url="https://api.example.com/webhook"
  label="Webhook URL"
  showOpenButton={false}
/>
```

**When to use:** API endpoints, webhooks, non-browser URLs

## Real-World Use Cases

### Admin Dashboard Quick Links

```typescript
<Card>
  <CardHeader>
    <h3>Test Links</h3>
  </CardHeader>
  <CardContent className="space-y-3">
    <CopyableLink 
      url="/admin/test-funnel"
      label="Funnel Test"
      showOpenButton={true}
    />
    <CopyableLink 
      url="/admin/analytics"
      label="Analytics Dashboard"
      showOpenButton={true}
    />
  </CardContent>
</Card>
```

### Agent Verification Email

```typescript
<CopyableLink 
  url={verificationUrl}
  label="Verify Your Listing"
  showOpenButton={true}
  className="my-4"
/>
```

### Payment Success Page

```typescript
<div className="space-y-4">
  <h2>Payment Confirmed!</h2>
  <CopyableLink 
    url={dashboardUrl}
    label="Go to Your Dashboard"
    showOpenButton={true}
  />
  <CopyableText 
    text={receiptId}
    label="Receipt ID"
  />
</div>
```

### Multi-Link Selection

```typescript
function TestLinksPanel() {
  return (
    <div className="space-y-3">
      <h3>Test Funnel Links</h3>
      
      <CopyableLink
        url={getFunnelUrl('step1')}
        label="Step 1: City Selection"
        showOpenButton={true}
      />
      
      <CopyableLink
        url={getFunnelUrl('step2')}
        label="Step 2: Neighborhood Selection"
        showOpenButton={true}
      />
      
      <CopyableLink
        url={getFunnelUrl('checkout')}
        label="Checkout"
        showOpenButton={true}
      />
    </div>
  );
}
```

## Styling

### Custom Styling

```typescript
<CopyableLink 
  url="https://example.com"
  className="bg-blue-50 border-blue-200"
/>
```

### Within Grids

```typescript
<div className="grid grid-cols-2 gap-4">
  <CopyableLink 
    url={url1}
    label="Link 1"
    variant="compact"
  />
  <CopyableLink 
    url={url2}
    label="Link 2"
    variant="compact"
  />
</div>
```

## Props Reference

### CopyableLink

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | `string` | required | The URL to display and copy |
| `label` | `string` | optional | Label above the link |
| `showOpenButton` | `boolean` | `true` | Show "Open in new tab" button |
| `className` | `string` | optional | Additional CSS classes |
| `variant` | `'default' \| 'compact' \| 'inline'` | `'default'` | Display style |

### CopyableText

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | required | The text to display and copy |
| `label` | `string` | optional | Label above the text |
| `masked` | `boolean` | `false` | Show only first/last chars |
| `className` | `string` | optional | Additional CSS classes |

## Migration Guide

### Old Pattern

```typescript
<div className="flex gap-2">
  <code>{url}</code>
  <Button onClick={() => {
    navigator.clipboard.writeText(url);
    toast.success('Copied!');
  }}>
    <Copy />
  </Button>
  <Button onClick={() => window.open(url, '_blank')}>
    <ExternalLink />
  </Button>
</div>
```

### New Pattern

```typescript
<CopyableLink url={url} />
```

✅ Less code  
✅ Consistent styling  
✅ Better mobile UX  
✅ Accessible  
✅ Toast notification included
