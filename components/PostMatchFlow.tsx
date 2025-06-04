import React from 'react';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Heart, MessageCircle, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../services/supabase';

export const PostMatchFlow: React.FC = () => {
  const { hasLiked, hasReceivedLike, matchedUser } = useStore();
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (hasLiked && hasReceivedLike) {
      setIsOpen(true);
    }
  }, [hasLiked, hasReceivedLike]);

  if (!hasLiked || !hasReceivedLike || !matchedUser) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-black/90 border border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            It's a Match! 🎉
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-pink-500">
              <img
                src={matchedUser.photo_url || '/default-avatar.png'}
                alt={matchedUser.first_name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-pink-500 rounded-full p-2">
              <Heart className="w-6 h-6 text-white" />
            </div>
          </motion.div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">
              {matchedUser.first_name} {matchedUser.last_name}
            </h3>
            <p className="text-gray-300">
              You both liked each other! Time to connect.
            </p>
          </div>

          <div className="flex space-x-4 w-full">
            <Button
              className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
              onClick={() => {
                // Handle message action
                setIsOpen(false);
              }}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Message
            </Button>
            <Button
              className="flex-1 bg-white/10 hover:bg-white/20 text-white"
              onClick={() => {
                // Handle follow action
                setIsOpen(false);
              }}
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Follow
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 