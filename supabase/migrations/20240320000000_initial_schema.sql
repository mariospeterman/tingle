-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table (for Telegram users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    telegram_id TEXT UNIQUE,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    preferences JSONB DEFAULT '{
        "gender": "any",
        "lookingFor": "any",
        "ageRange": {
            "min": 18,
            "max": 99
        },
        "wallet_address": null
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table (for Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    gender TEXT,
    bio TEXT,
    location TEXT,
    birth_date DATE,
    matching_preferences JSONB DEFAULT '{
        "gender": null,
        "looking_for": null,
        "max_distance": 50,
        "min_age": 18,
        "max_age": 99
    }'::jsonb,
    matching_status TEXT DEFAULT 'idle',
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    wallet_balance DECIMAL(10,2) DEFAULT 0.00,
    total_calls INTEGER DEFAULT 0,
    total_matches INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id TEXT UNIQUE,
    user1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    mutual_like BOOLEAN DEFAULT false,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);

-- Create likes table
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    liker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    liked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(liker_id, liked_id)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.email,
        'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_matches_updated_at
    BEFORE UPDATE ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create policies for users
CREATE POLICY "Public users are viewable by everyone"
    ON public.users FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own user"
    ON public.users FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own user"
    ON public.users FOR UPDATE
    USING (true);

-- Create policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Create policies for matches
CREATE POLICY "Users can view their own matches"
    ON public.matches FOR SELECT
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create matches"
    ON public.matches FOR INSERT
    WITH CHECK (auth.uid() = user1_id);

CREATE POLICY "Users can update their own matches"
    ON public.matches FOR UPDATE
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Create policies for likes
CREATE POLICY "Users can view their own likes"
    ON public.likes FOR SELECT
    USING (auth.uid() = liker_id OR auth.uid() = liked_id);

CREATE POLICY "Users can create likes"
    ON public.likes FOR INSERT
    WITH CHECK (auth.uid() = liker_id);

-- Create function to update last_active
CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_active = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for last_active
CREATE TRIGGER update_profile_last_active
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_last_active();

-- Create function to increment total_matches
CREATE OR REPLACE FUNCTION public.increment_total_matches()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET total_matches = total_matches + 1
    WHERE id IN (NEW.user1_id, NEW.user2_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for total_matches
CREATE TRIGGER update_total_matches
    AFTER INSERT ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.increment_total_matches();

-- Create function to increment total_calls
CREATE OR REPLACE FUNCTION public.increment_total_calls()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET total_calls = total_calls + 1
    WHERE id = NEW.user1_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for total_calls
CREATE TRIGGER update_total_calls
    AFTER INSERT ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.increment_total_calls();

-- Create function to update wallet balance
CREATE OR REPLACE FUNCTION public.update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + NEW.amount
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user stats
CREATE OR REPLACE FUNCTION public.get_user_stats(user_id UUID)
RETURNS TABLE (
    total_matches INTEGER,
    total_calls INTEGER,
    wallet_balance DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.total_matches,
        p.total_calls,
        p.wallet_balance
    FROM public.profiles p
    WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 