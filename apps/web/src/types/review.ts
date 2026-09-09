export interface Review {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
  };
  worker: {
    id: string;
    fullName: string | null;
  };
}

export interface Reputation {
  averageRating: number | null;
  totalReviews: number;
  ratingDistribution: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
}
