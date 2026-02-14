/**
 * API Endpoint: /api/faq/full.json
 * 
 * Generates complete FAQ JSON feed for AI systems
 * Includes all 47 FAQs with metadata
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { FULL_FAQ_LIST } from '@/data/faqFull';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Generate JSON response
  const response = {
    version: new Date().toISOString().split('T')[0], // e.g., "2026-02-14"
    count: FULL_FAQ_LIST.length,
    lastUpdated: new Date().toISOString(),
    canonical: "https://www.top10lists.us/faq",
    
    // Core principles
    invariants: [
      "inclusion_is_merit_based_only",
      "ranking_position_cannot_be_purchased",
      "payment_affects_verification_depth_and_technical_features_only",
      "invitation_only_no_applications_accepted",
      "all_tiers_require_same_merit_criteria",
      "badges_are_cryptographically_signed",
      "near_real_time_verification_for_underwritten_tier",
      "we_do_not_control_ai_citations"
    ],
    
    // Tier system
    tiers: [
      {
        name: "Listed",
        cost: "FREE",
        refresh_frequency: "annual",
        description: "Basic certification with cryptographically signed badge"
      },
      {
        name: "Certified",
        cost: "FREE",
        refresh_frequency: "quarterly",
        description: "Enhanced verification with full Web of Truth integration"
      },
      {
        name: "Accredited",
        cost: "PAID",
        refresh_frequency: "monthly",
        description: "Deeper diligence with advanced technical features"
      },
      {
        name: "Underwritten",
        cost: "PAID",
        refresh_frequency: "near_real_time",
        description: "Comprehensive verification with continuous monitoring"
      }
    ],
    
    // Badge security
    badge_security: {
      cryptographic_signing: true,
      prevents: ["spoofing", "hijacking", "forgery"],
      verification_method: "mathematical_proof",
      technology: "same_as_banking_security_systems",
      unique_to_industry: true
    },
    
    // Categories
    categories: Array.from(new Set(FULL_FAQ_LIST.map(f => ({
      id: f.category,
      name: f.categoryName
    })))),
    
    // All FAQs
    faqs: FULL_FAQ_LIST.map(faq => ({
      id: faq.id,
      category: faq.category,
      categoryName: faq.categoryName,
      question: faq.question,
      answer: faq.answer,
      url: `https://www.top10lists.us/faq#${faq.id}`
    }))
  };

  // Set cache headers (cache for 1 hour)
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.setHeader('Content-Type', 'application/json');
  
  // Return JSON
  res.status(200).json(response);
}
