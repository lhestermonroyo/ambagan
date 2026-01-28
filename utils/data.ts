import { Session } from '@supabase/supabase-js';
import { AuthState, User, UserPreview } from '../types/auth';
import { Group, GroupPreview, GroupState } from '../types/groups';
import {
  Transaction,
  TransactionPreview,
  TransactionState
} from '../types/transactions';

// Mock Users
export const mockUsers: User[] = [
  {
    id: 'user-1',
    created_at: '2024-01-01T08:00:00Z',
    email: 'john.doe@email.com',
    phone: '+639123456789',
    first_name: 'John',
    last_name: 'Doe',
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: 'user-2',
    created_at: '2024-01-02T09:15:00Z',
    email: 'jane.smith@email.com',
    phone: '+639987654321',
    first_name: 'Jane',
    last_name: 'Smith',
    avatar:
      'https://images.unsplash.com/photo-1494790108755-2616b612b5bc?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: 'user-3',
    created_at: '2024-01-03T10:30:00Z',
    email: 'mike.johnson@email.com',
    phone: null,
    first_name: 'Mike',
    last_name: 'Johnson',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: 'user-4',
    created_at: '2024-01-04T11:45:00Z',
    email: 'sarah.wilson@email.com',
    phone: '+639111222333',
    first_name: 'Sarah',
    last_name: 'Wilson',
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: 'user-5',
    created_at: '2024-01-05T12:00:00Z',
    email: 'alex.brown@email.com',
    phone: '+639444555666',
    first_name: 'Alex',
    last_name: 'Brown',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: 'user-6',
    created_at: '2024-01-06T13:15:00Z',
    email: 'emma.davis@email.com',
    phone: null,
    first_name: 'Emma',
    last_name: 'Davis',
    avatar:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face'
  }
];

// Convert users to UserPreview format
export const mockUserPreviews: UserPreview[] = mockUsers.map((user) => ({
  id: user.id,
  email: user.email,
  first_name: user.first_name,
  last_name: user.last_name,
  avatar: user.avatar
}));

// Mock current user (first user in the list)
export const mockCurrentUser = mockUsers[0];

// Mock Session
export const mockSession: Session = {
  access_token: 'mock_access_token_12345',
  refresh_token: 'mock_refresh_token_67890',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: mockCurrentUser.id,
    email: mockCurrentUser.email,
    aud: 'authenticated',
    role: 'authenticated',
    created_at: mockCurrentUser.created_at,
    updated_at: mockCurrentUser.created_at,
    app_metadata: {},
    user_metadata: {
      first_name: mockCurrentUser.first_name,
      last_name: mockCurrentUser.last_name
    }
  }
};

// Mock Transactions
export const mockTransactions: Transaction[] = [
  {
    id: 'transaction-1',
    created_at: '2024-01-15T12:30:00Z',
    created_by: mockUserPreviews[0],
    paid_by: mockUserPreviews[0],
    type: 'expense',
    amount: 1500.0,
    description: 'Grocery shopping for the week',
    receipt_ref_number: 'GRC-001-2024',
    receipt_photo:
      'https://images.unsplash.com/photo-1586883716612-4251a1b5e0ed?w=300&h=400&fit=crop',
    splits: [
      { member: mockUserPreviews[0], amount: 375.0 },
      { member: mockUserPreviews[1], amount: 375.0 },
      { member: mockUserPreviews[2], amount: 375.0 },
      { member: mockUserPreviews[3], amount: 375.0 }
    ]
  },
  {
    id: 'transaction-2',
    created_at: '2024-01-16T18:45:00Z',
    created_by: mockUserPreviews[1],
    paid_by: mockUserPreviews[1],
    type: 'expense',
    amount: 800.0,
    description: 'Pizza dinner for group',
    receipt_ref_number: null,
    receipt_photo: null,
    splits: [
      { member: mockUserPreviews[0], amount: 200.0 },
      { member: mockUserPreviews[1], amount: 200.0 },
      { member: mockUserPreviews[2], amount: 200.0 },
      { member: mockUserPreviews[3], amount: 200.0 }
    ]
  },
  {
    id: 'transaction-3',
    created_at: '2024-01-17T14:20:00Z',
    created_by: mockUserPreviews[2],
    paid_by: mockUserPreviews[0],
    type: 'payment',
    amount: 200.0,
    description: 'Payment from Mike to John',
    receipt_ref_number: null,
    receipt_photo: null,
    splits: [
      { member: mockUserPreviews[2], amount: -200.0 },
      { member: mockUserPreviews[0], amount: 200.0 }
    ]
  },
  {
    id: 'transaction-4',
    created_at: '2024-01-18T10:15:00Z',
    created_by: mockUserPreviews[3],
    paid_by: mockUserPreviews[3],
    type: 'expense',
    amount: 2400.0,
    description: 'Utilities bill - electricity and water',
    receipt_ref_number: 'UTIL-002-2024',
    receipt_photo:
      'https://images.unsplash.com/photo-1544986581-efac024faf62?w=300&h=400&fit=crop',
    splits: [
      { member: mockUserPreviews[0], amount: 600.0 },
      { member: mockUserPreviews[1], amount: 600.0 },
      { member: mockUserPreviews[2], amount: 600.0 },
      { member: mockUserPreviews[3], amount: 600.0 }
    ]
  },
  {
    id: 'transaction-5',
    created_at: '2024-01-19T16:30:00Z',
    created_by: mockUserPreviews[0],
    paid_by: mockUserPreviews[0],
    type: 'expense',
    amount: 650.0,
    description: 'Gas refill for cooking',
    receipt_ref_number: 'GAS-003-2024',
    receipt_photo: null,
    splits: [
      { member: mockUserPreviews[0], amount: 162.5 },
      { member: mockUserPreviews[1], amount: 162.5 },
      { member: mockUserPreviews[2], amount: 162.5 },
      { member: mockUserPreviews[3], amount: 162.5 }
    ]
  }
];

export const mockTransactionPreviews: TransactionPreview[] =
  mockTransactions.map((transaction) => ({
    id: transaction.id,
    created_at: transaction.created_at,
    created_by: transaction.created_by,
    paid_by: transaction.paid_by,
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description
  }));

// Mock Groups with Members and Transactions
export const mockGroups: Group[] = [
  {
    id: 'group-1',
    created_at: '2024-01-15T10:30:00Z',
    creator: mockUserPreviews[0],
    name: 'College Roommates',
    description: 'Sharing expenses for our apartment and daily costs',
    category: 'household',
    cover:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=150&h=150&fit=crop&crop=center',
    members: [
      { joined_at: '2024-01-15T10:30:00Z', user: mockUserPreviews[0] },
      { joined_at: '2024-01-15T10:35:00Z', user: mockUserPreviews[1] },
      { joined_at: '2024-01-15T10:40:00Z', user: mockUserPreviews[2] },
      { joined_at: '2024-01-15T10:45:00Z', user: mockUserPreviews[3] }
    ],
    transactions: mockTransactionPreviews.slice(0, 3)
  },
  {
    id: 'group-2',
    created_at: '2024-01-20T14:15:00Z',
    creator: mockUserPreviews[1],
    name: 'Family',
    description: 'Family expenses and household bills',
    category: 'family',
    cover: null,
    members: [
      { joined_at: '2024-01-20T14:15:00Z', user: mockUserPreviews[1] },
      { joined_at: '2024-01-20T14:20:00Z', user: mockUserPreviews[4] },
      { joined_at: '2024-01-20T14:25:00Z', user: mockUserPreviews[5] }
    ],
    transactions: []
  },
  {
    id: 'group-3',
    created_at: '2024-01-22T09:45:00Z',
    creator: mockUserPreviews[2],
    name: 'Weekend Trip',
    description: 'Expenses for our weekend getaway to Baguio',
    category: 'travel',
    cover:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=150&h=150&fit=crop&crop=center',
    members: [
      { joined_at: '2024-01-22T09:45:00Z', user: mockUserPreviews[2] },
      { joined_at: '2024-01-22T09:50:00Z', user: mockUserPreviews[0] },
      { joined_at: '2024-01-22T09:55:00Z', user: mockUserPreviews[3] }
    ],
    transactions: mockTransactionPreviews.slice(3, 5)
  },
  {
    id: 'group-4',
    created_at: '2024-01-25T16:20:00Z',
    creator: mockUserPreviews[3],
    name: 'Office Team',
    description: 'Team lunches and office parties',
    category: 'work',
    cover: null,
    members: [
      { joined_at: '2024-01-25T16:20:00Z', user: mockUserPreviews[3] },
      { joined_at: '2024-01-25T16:25:00Z', user: mockUserPreviews[1] },
      { joined_at: '2024-01-25T16:30:00Z', user: mockUserPreviews[4] },
      { joined_at: '2024-01-25T16:35:00Z', user: mockUserPreviews[5] },
      { joined_at: '2024-01-25T16:40:00Z', user: mockUserPreviews[0] }
    ],
    transactions: []
  },
  {
    id: 'group-5',
    created_at: '2024-01-28T11:10:00Z',
    creator: mockUserPreviews[4],
    name: 'Gym Buddies',
    description: 'Sharing gym membership and supplements costs',
    category: 'sports',
    cover:
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&h=150&fit=crop&crop=center',
    members: [
      { joined_at: '2024-01-28T11:10:00Z', user: mockUserPreviews[4] },
      { joined_at: '2024-01-28T11:15:00Z', user: mockUserPreviews[2] },
      { joined_at: '2024-01-28T11:20:00Z', user: mockUserPreviews[5] }
    ],
    transactions: []
  },
  {
    id: 'group-6',
    created_at: '2024-02-01T13:30:00Z',
    creator: mockUserPreviews[5],
    name: 'Book Club',
    description: 'Monthly book purchases and coffee meetups',
    category: 'social',
    cover: null,
    members: [
      { joined_at: '2024-02-01T13:30:00Z', user: mockUserPreviews[5] },
      { joined_at: '2024-02-01T13:35:00Z', user: mockUserPreviews[1] },
      { joined_at: '2024-02-01T13:40:00Z', user: mockUserPreviews[3] }
    ],
    transactions: []
  }
];

export const mockGroupPreviews: GroupPreview[] = mockGroups.map((group) => ({
  id: group.id,
  created_at: group.created_at,
  creator: group.creator,
  name: group.name,
  cover: group.cover,
  category: group.category
}));

// Mock States
export const mockAuthState: AuthState = {
  loggingOut: false,
  user: mockCurrentUser,
  session: mockSession
};

export const mockGroupState: GroupState = {
  groups: mockGroupPreviews,
  details: mockGroups[0] // College Roommates as current selected group
};

export const mockTransactionState: TransactionState = {
  preview: mockTransactionPreviews,
  details: mockTransactions[0] // First transaction as current selected transaction
};
