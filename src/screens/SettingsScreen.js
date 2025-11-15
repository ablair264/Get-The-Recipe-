import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Image, Alert, ScrollView, Linking, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { AppContext } from '../context/AppContext';
import CustomHeader from '../components/CustomHeader';
import CurvedBottomBar from '../components/CurvedBottomBar';
import { resetTour } from '../utils/tourManager';

export default function SettingsScreen({ navigation }) {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user, supabaseClient, useUKMeasurements, setUseUKMeasurements, updateDisplayName } = context;
  const isAnonymous = !!(user?.is_anonymous || user?.app_metadata?.provider === 'anonymous');

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
    setDisplayName(fullName);
    setEmail(user?.email || '');
  }, [user]);

  const handleSaveDisplayName = async () => {
    if (!user) return;
    try {
      setSavingName(true);
      const name = (displayName || '').trim();
      if (updateDisplayName) {
        await updateDisplayName(name);
      } else {
        const { error } = await supabaseClient.auth.updateUser({ data: { full_name: name } });
        if (error) throw error;
      }
      Alert.alert('Saved', 'Display name updated');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to update display name');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!supabaseClient || !user) return;
    const newEmail = (email || '').trim();
    if (!newEmail) {
      Alert.alert('Email required', 'Please enter a valid email');
      return;
    }
    try {
      setSavingEmail(true);
      const { error } = await supabaseClient.auth.updateUser({ email: newEmail });
      if (error) throw error;
      Alert.alert('Check your email', 'Confirm the change from the link emailed to you.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to update email');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleResetPassword = async () => {
    if (!supabaseClient || !email) return;
    try {
      setResetting(true);
      // Optional redirectTo can be a deep link your app handles; omitted if not configured.
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
      if (error) throw error;
      Alert.alert('Email sent', 'Check your inbox for a reset link.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to send reset email');
    } finally {
      setResetting(false);
    }
  };

  const applyMeasurementPref = async (pref) => {
    try {
      setUseUKMeasurements(pref === 'UK');
      // Persist to auth metadata for future sessions (best-effort)
      if (supabaseClient) {
        await supabaseClient.auth.updateUser({ data: { default_units: pref.toLowerCase() } });
      }
    } catch (_) {}
  };

  const handleDeleteAccount = async () => {
    if (!supabaseClient || !user) return;
    Alert.alert(
      'Delete Account',
      'This will permanently delete your saved recipes, pantry, categories, and ratings. You will be signed out. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              setDeleting(true);
              // Delete dependent data (best-effort; ignore failures)
              try { await supabaseClient.from('recipe_ratings').delete().eq('user_id', user.id); } catch (_) {}
              try { await supabaseClient.from('pantry_items').delete().eq('user_id', user.id); } catch (_) {}
              try { await supabaseClient.from('recipes').delete().eq('user_id', user.id); } catch (_) {}
              try { await supabaseClient.from('categories').delete().eq('user_id', user.id); } catch (_) {}
              // Note: deleting the auth user requires a server-side service role.
              await supabaseClient.auth.signOut();
              Alert.alert('Account data deleted', 'Your data has been removed. Contact support to fully remove your auth account.');
              navigation.reset({ index: 0, routes: [{ name: 'Parser' }] });
            } catch (e) {
              Alert.alert('Error', e?.message || 'Failed to delete account data.');
            } finally {
              setDeleting(false);
            }
          } 
        }
      ]
    );
  };

  const openSupport = async () => {
    const url = 'mailto:alastair.blair@splitfin.uk?subject=Recipe%20Parser%20Support';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch (_) {}
  };

  const handleLogout = async () => {
    try { await supabaseClient?.auth?.signOut(); } catch (_) {}
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor="#ff8243" barStyle="light-content" />

      {/* CustomHeader */}
      <CustomHeader
        title="Settings"
        subtitle="Manage your profile and preferences"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <SafeAreaView style={styles.safeContent}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Profile section (hidden for anonymous users) */}
          {!isAnonymous && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Profile</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
                <TouchableOpacity 
                  style={[styles.primaryBtn, savingName && styles.disabledBtn]}
                  onPress={handleSaveDisplayName}
                  disabled={savingName}
                >
                  <Text style={styles.primaryBtnText}>{savingName ? 'Saving...' : 'Save Name'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TouchableOpacity 
                  style={[styles.secondaryBtn, savingEmail && styles.disabledBtn]}
                  onPress={handleSaveEmail}
                  disabled={savingEmail}
                >
                  <Text style={styles.secondaryBtnText}>{savingEmail ? 'Updating...' : 'Change Email'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.linkBtn, resetting && styles.disabledBtn]}
                onPress={handleResetPassword}
                disabled={resetting}
              >
                <Ionicons name="refresh" size={16} color={colors.orange_pantone[500]} />
                <Text style={styles.linkBtnText}>{resetting ? 'Sending...' : 'Reset Password'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Preferences */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Preferences</Text>
            <Text style={styles.label}>Default Measurements</Text>
            <View style={styles.unitsRow}>
              <TouchableOpacity 
                style={[styles.unitOption, !useUKMeasurements && styles.unitOptionActive]}
                onPress={() => applyMeasurementPref('US')}
              >
                <Text style={[styles.unitOptionText, !useUKMeasurements && styles.unitOptionTextActive]}>US</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.unitOption, useUKMeasurements && styles.unitOptionActive]}
                onPress={() => applyMeasurementPref('UK')}
              >
                <Text style={[styles.unitOptionText, useUKMeasurements && styles.unitOptionTextActive]}>UK</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>Recipes reflect this preference automatically.</Text>
          </View>

          {/* Tutorial */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tutorial</Text>
            <TouchableOpacity
              style={styles.tutorialBtn}
              onPress={async () => {
                await resetTour();
                Alert.alert(
                  'Tutorial Reset',
                  'The tutorial will show next time you open the app.',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Ionicons name="help-circle-outline" size={20} color="#fff" />
              <Text style={styles.tutorialBtnText}>Show Tutorial</Text>
            </TouchableOpacity>
          </View>

          {/* Danger zone (hidden for anonymous users) */}
          {!isAnonymous && (
            <View style={styles.cardDanger}>
              <Text style={styles.cardTitleDanger}>Danger Zone</Text>
              <TouchableOpacity 
                style={[styles.dangerBtn, deleting && styles.disabledBtn]}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                <Ionicons name="trash" size={16} color="#fff" />
                <Text style={styles.dangerBtnText}>{deleting ? 'Deleting…' : 'Delete Account'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Support */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Support</Text>
            <TouchableOpacity style={styles.supportBtn} onPress={openSupport}>
              <Ionicons name="mail" size={16} color="#fff" />
              <Text style={styles.supportBtnText}>Email alastair.blair@splitfin.uk</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Curved Bottom Navigation Bar */}
      <CurvedBottomBar
        navigation={navigation}
        activeRoute="Settings"
        dynamicButtonMode="help"
        dynamicButtonShowGlow={false}
        dynamicButtonOnPress={openSupport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: '#fff9e6',
  },
  safeContent: {
    flex: 1,
    backgroundColor: '#fff9e6',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDanger: {
    backgroundColor: '#fff7f7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffd4d4',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.charcoal[500],
    marginBottom: 12,
  },
  cardTitleDanger: {
    fontSize: 18,
    fontWeight: '800',
    color: '#b00020',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoal[500],
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: '#ff8243',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: 'rgba(255,130,67,0.08)',
    color: colors.charcoal[500],
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: '#ff8243',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: '#f7ae2d',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  linkBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  linkBtnText: {
    color: colors.orange_pantone[500],
    fontWeight: '700',
  },
  unitsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  unitOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ff8243',
    backgroundColor: 'transparent',
  },
  unitOptionActive: {
    backgroundColor: '#ff8243',
  },
  unitOptionText: {
    color: colors.charcoal[500],
    fontWeight: '700',
  },
  unitOptionTextActive: {
    color: '#fff',
  },
  helpText: {
    marginTop: 8,
    color: colors.charcoal[400],
    fontSize: 12,
    fontWeight: '500',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d32f2f',
    paddingVertical: 12,
    borderRadius: 10,
  },
  dangerBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.lapis_lazuli[500],
    paddingVertical: 12,
    borderRadius: 10,
  },
  supportBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  tutorialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.orange_pantone[500],
    paddingVertical: 12,
    borderRadius: 10,
  },
  tutorialBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#ff8243',
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomNavButton: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  bottomNavText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomNavLogoContainer: {
    position: 'absolute',
    top: -32,
    left: '50%',
    marginLeft: -40,
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    zIndex: 100,
  },
});
