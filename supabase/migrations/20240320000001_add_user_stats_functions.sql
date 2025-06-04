-- Function to increment total matches
CREATE OR REPLACE FUNCTION increment_total_matches(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET total_matches = total_matches + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment total calls
CREATE OR REPLACE FUNCTION increment_total_calls(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET total_calls = total_calls + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance(
  user_id UUID,
  amount DECIMAL(10,2)
)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET wallet_balance = wallet_balance + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user stats
CREATE OR REPLACE FUNCTION get_user_stats(user_id UUID)
RETURNS TABLE (
  total_matches INTEGER,
  total_calls INTEGER,
  wallet_balance DECIMAL(10,2),
  mutual_likes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.total_matches,
    p.total_calls,
    p.wallet_balance,
    COUNT(DISTINCT m.id)::INTEGER as mutual_likes
  FROM profiles p
  LEFT JOIN matches m ON 
    (m.user1_id = p.id OR m.user2_id = p.id) AND
    m.mutual_like = true
  WHERE p.id = user_id
  GROUP BY p.id, p.total_matches, p.total_calls, p.wallet_balance;
END;
$$ LANGUAGE plpgsql; 