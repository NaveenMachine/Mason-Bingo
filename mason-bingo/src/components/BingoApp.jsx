import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import emailjs from 'emailjs-com';
import './BingoApp.css';

// Initialize Supabase using environment variables
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ADMINS = ['nrk5727@gmail.com', 'freyhofnolan@gmail.com'];

export default function BingoApp() {
  const [user, setUser] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [activeEvents, setActiveEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');

  // Load existing session from local storage
  useEffect(() => {
    const savedUser = localStorage.getItem('bingo_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleJoin = async () => {
    if (!emailInput) return;
    const email = emailInput.toLowerCase().trim();

    // Check if user already has a card
    let { data } = await supabase.from('user_cards').select('*').eq('email', email).single();

    if (!data) {
      // Create a randomized 5x5 board
      const squares = [
        '"Diddy"', '"Woke"', '"I don’t know Jim"', '"Liberals"', '"When in Rome"',
        '"I’m so drunk right now"', "The Drunken Lean", '"Drakeeeee"',
        '"Money market mutual fund"', "Saying IRA with hand gesticulation", '"I’m on alcohol"',
        '"Time to morb"', '"Gulp"', '"[Reference nobody gets]"', '"The thing about..."',
        '"Walter"', '"I’m joking"', '"IT’S GETTING STICKY"', '"Latina Baddie"',
        'blah blah "Epstein"', "Charlie Charlie Kirky I just popped a pirky", 'blah blah "Les Wexner"', '"Jimmer"', '"Aloha"'
      ].sort(() => Math.random() - 0.5);

      squares.splice(12, 0, "FREE SPACE"); // Insert free space in the center

      const { data: newCard, error } = await supabase
        .from('user_cards')
        .insert([{ email: email, card_layout: squares }])
        .select()
        .single();

      if (error) return console.error("Error creating card:", error);
      data = newCard;
    }

    setUser(data);
    localStorage.setItem('bingo_user', JSON.stringify(data));
  };

  useEffect(() => {
    // Initial fetch of active bingo events
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('bingo_events')
        .select('name')
        .eq('is_active', true);
      if (data) setActiveEvents(data.map(e => e.name));
    };

    fetchEvents();

    // Subscribe to real-time database updates
    const channel = supabase
      .channel('bingo-updates')
      .on('postgres_changes', { event: 'UPDATE', table: 'bingo_events' }, fetchEvents)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const triggerEvent = async () => {
    if (!selectedEvent || selectedEvent === "Select an event...") return;

    // 1. Mark the event as active in Supabase
    const { error: updateError } = await supabase
      .from('bingo_events')
      .update({ is_active: true })
      .eq('name', selectedEvent);

    if (!updateError) {
      // 2. Fetch all registered player emails
      const { data: players, error: fetchError } = await supabase
        .from('user_cards')
        .select('email');

      if (!fetchError && players) {
        // 3. Loop through and send an email alert to every player
        players.forEach((player) => {
          emailjs.send(
            import.meta.env.VITE_EMAILJS_SERVICE_ID,
            import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
            {
              message: `Mason just did "${selectedEvent}". Take a shot. 🍻`,
              to_email: player.email // Dynamically targets each player's email address
            },
            import.meta.env.VITE_EMAILJS_PUBLIC_KEY
          );
        });
      }
      
      setSelectedEvent(''); // Reset the dropdown
    } else {
      console.error("Update error:", updateError);
    }
  };

  // Auth/Join Screen
  if (!user) {
    return (
      <div className="joinOverlay">
        <div className="joinCard">
          <h1 className="joinTitle">MASON BINGO</h1>
          <input
            type="email"
            placeholder="Enter Email to Play"
            className="joinInput"
            onChange={(e) => setEmailInput(e.target.value)}
          />
          <button onClick={handleJoin} className="joinButton">
            JOIN GAME 🍻
          </button>
        </div>
      </div>
    );
  }

  // Main Bingo Board UI
  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Mason Bingo</h1>
        <p className="subtitle">Logged in: {user.email}</p>
        <p>Spotted an event? Alert an admin (Naveen/Nolan) to mark the board!</p>
      </header>

      <div className="gridWrap">
        <div className="grid">
          {user.card_layout.map((item, i) => {
            const isMarked = activeEvents.includes(item) || item === "FREE SPACE";
            return (
              <div
                key={i}
                className={`cell ${isMarked ? 'cellMarked' : 'cellUnmarked'}`}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>

      

      {/* Admin Panel (Restricted to specific emails) */}
      {ADMINS.includes(user.email) && (
        <div className="adminPanel">
          <label className="adminLabel">Admin: Trigger Mason Action</label>
          <div className="adminRow">
            <select
              className="adminSelect"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
            >
              <option value="">Select an event...</option>
              {[
                '"Diddy"', '"Woke"', '"I don’t know Jim"', '"Liberals"', '"When in Rome"',
  '"I’m so drunk right now"', "The Drunken Lean", '"Drakeeeee"',
  '"Money market mutual fund"', "Saying IRA with hand gesticulation", '"I’m on alcohol"',
  '"Time to morb"', '"Gulp"', '"[Reference nobody gets]"', '"The thing about..."',
  '"Walter"', '"I’m joking"', '"IT’S GETTING STICKY"', '"Latina Baddie"',
  'blah blah "Epstein"', "Charlie Charlie Kirky I just popped a pirky", 'blah blah "Les Wexner"', '"Jimmer"', '"Aloha"'
              ].sort().map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>

            <button onClick={triggerEvent} className="adminSend">
              Send 🚨
            </button>
          </div>
        </div>
      )}
    </div>
  );
}