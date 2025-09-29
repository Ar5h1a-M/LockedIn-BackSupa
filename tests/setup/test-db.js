// tests/setup/test-db.js
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

class TestDatabase {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('Using Supabase URL:', supabaseUrl);
    console.log('Service role key present:', !!supabaseKey);
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }

    });
    
    this.testData = {};
    this.testUser = null;
    this.testId = uuidv4().substring(0, 8);
  }

  async createTestUser() {
    const email = `test-${this.testId}-${Date.now()}@example.com`;
    const password = 'testpassword123';
    
    console.log(`Creating test user: ${email}`);
    
    try {
      // Create auth user using admin API
      const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      
      if (authError) {
        console.error('Auth user creation error:', authError);
        throw authError;
      }
      
      // Create profile in PUBLIC schema
      const { data: profileData, error: profileError } = await this.supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          full_name: `Test User ${this.testId}`,
          degree: 'Computer Science',
          modules: ['COMS3008'],
          interest: 'Testing'
        })
        .select()
        .single();
      
      if (profileError) {
        console.error('Profile creation error:', profileError);
        await this.supabase.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }
      
      this.testUser = {
        auth: authData.user,
        profile: profileData
      };
      
      return this.testUser;
      
    } catch (error) {
      console.error('Error in createTestUser:', error);
      throw error;
    }
  }

  async createTestGroup(userId) {
    try {
      const { data, error } = await this.supabase
        .from('groups')
        .insert({
          name: `Test Group ${this.testId}-${Date.now()}`,
          owner_id: userId,
          module: 'COMS3008'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add user as group member with owner role
      const { error: memberError } = await this.supabase
        .from('group_members')
        .insert({
          group_id: data.id,
          user_id: userId,
          role: 'owner'
        });
      
      if (memberError) throw memberError;
      
      this.testData.group = data;
      return data;
      
    } catch (error) {
      console.error('Error in createTestGroup:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.testUser) {
        console.log(`Cleaning up test user: ${this.testUser.auth.email}`);
        
        // Clean up all test data for this user in PUBLIC schema
        const userId = this.testUser.auth.id;
        
        // Clean up in dependency order
        await this.supabase.from('session_invites').delete().eq('user_id', userId);
        await this.supabase.from('user_progress').delete().eq('user_id', userId);
        await this.supabase.from('group_messages').delete().eq('sender_id', userId);
        await this.supabase.from('sessions').delete().eq('creator_id', userId);
        await this.supabase.from('group_invitations').delete().eq('sender_id', userId).or(`recipient_id.eq.${userId}`);
        await this.supabase.from('group_members').delete().eq('user_id', userId);
        await this.supabase.from('groups').delete().eq('owner_id', userId);
        await this.supabase.from('friendships').delete().eq('user_id', userId).or(`friend_id.eq.${userId}`);
        await this.supabase.from('invitations').delete().eq('sender_id', userId).or(`recipient_id.eq.${userId}`);
        await this.supabase.from('tests').delete().eq('user_id', userId);
        await this.supabase.from('profiles').delete().eq('id', userId);
        
        // Delete auth user
        await this.supabase.auth.admin.deleteUser(userId);
      }
      
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      this.testUser = null;
      this.testData = {};
    }
  }

  async getAuthToken() {
    if (!this.testUser) {
      await this.createTestUser();
    }
    
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: this.testUser.auth.email,
      password: 'testpassword123'
    });
    
    if (error) throw error;
    return data.session.access_token;
  }
}

export default TestDatabase;