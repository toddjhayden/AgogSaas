import { gql } from '@apollo/client';

export const GET_JOB_POSTINGS = gql`
  query GetJobPostings($status: String, $sortBy: String) {
    jobPostings(status: $status, sortBy: $sortBy) {
      id
      jobNumber
      title
      description
      quantity
      material
      specifications
      deadline
      budget
      currency
      status
      bidCount
      postedBy
      postedDate
    }
  }
`;

export const GET_MY_BIDS = gql`
  query GetMyBids($status: String) {
    myBids(status: $status) {
      id
      bidNumber
      jobId
      jobTitle
      bidAmount
      currency
      deliveryDate
      notes
      status
      submittedDate
      respondedDate
    }
  }
`;

export const GET_PARTNER_NETWORK = gql`
  query GetPartnerNetwork($searchTerm: String, $capability: String) {
    partners(searchTerm: $searchTerm, capability: $capability) {
      id
      companyName
      contactName
      email
      phone
      location
      capabilities
      certifications
      rating
      completedJobs
      onTimeRate
    }
  }
`;

export const GET_MARKETPLACE_ANALYTICS = gql`
  query GetMarketplaceAnalytics($startDate: Date, $endDate: Date) {
    marketplaceAnalytics(startDate: $startDate, endDate: $endDate) {
      totalJobsPosted
      totalBidsReceived
      averageBidsPerJob
      jobFillRate
      averageResponseTime
      totalRevenue
      topPartners {
        partnerId
        partnerName
        jobsCompleted
        revenue
      }
    }
  }
`;

export const GET_WHITE_LABEL_BILLING = gql`
  query GetWhiteLabelBilling($clientId: UUID) {
    whiteLabelBilling(clientId: $clientId) {
      clientId
      clientName
      billingModel
      markupPercent
      monthlyFee
      transactionFee
      totalRevenue
      totalCosts
      netProfit
      currency
    }
  }
`;
