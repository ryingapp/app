import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, fontSize } from '../constants/theme';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { LoyaltyProfile, LoyaltyReward, LoyaltyTier, PointsTransaction } from '../constants/types';
import { api } from '../services/api';
import { DrawerMenuButton } from '../components/DrawerMenuButton';

type TabKey = 'customers' | 'rewards';
type FilterKey = 'all' | 'vip' | 'gold' | 'silver' | 'bronze';

const TIER_CONFIG: Record<LoyaltyTier, { icon: string; color: string; nextTier: string; nextPoints: number }> = {
  bronze: { icon: '🥉', color: '#CD7F32', nextTier: 'Silver', nextPoints: 1000 },
  silver: { icon: '🥈', color: '#94A3B8', nextTier: 'Gold', nextPoints: 2000 },
  gold: { icon: '🥇', color: '#FBBF24', nextTier: 'VIP', nextPoints: 4000 },
  vip: { icon: '💎', color: '#A78BFA', nextTier: '', nextPoints: 0 },
};

export default function LoyaltyScreen() {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const [profiles, setProfiles] = useState<LoyaltyProfile[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('customers');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<LoyaltyProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemProfile, setRedeemProfile] = useState<LoyaltyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadLoyaltyData = async () => {
    setIsLoading(true);
    try {
      const [customers, coupons] = await Promise.all([
        api.customers.list(),
        api.coupons.list().catch(() => []),
      ]);

        const mapTier = (totalSpent: number, totalOrders: number): LoyaltyTier => {
          if (totalSpent >= 4000 || totalOrders >= 60) return 'vip';
          if (totalSpent >= 2000 || totalOrders >= 30) return 'gold';
          if (totalSpent >= 1000 || totalOrders >= 15) return 'silver';
          return 'bronze';
        };

        const mappedProfiles: LoyaltyProfile[] = (customers || []).map((customer: any) => {
          const totalSpent = Number(customer?.totalSpent || 0);
          const totalVisits = Number(customer?.totalOrders || 0);
          const totalPoints = Math.floor(totalSpent);
          const availablePoints = Math.floor(totalPoints * 0.8);
          const tier = mapTier(totalSpent, totalVisits);

          return {
            customerId: customer?.id,
            customerName: customer?.name || (language === 'ar' ? 'عميل' : 'Customer'),
            phone: customer?.phone || '-',
            tier,
            totalPoints,
            availablePoints,
            totalSpent,
            totalVisits,
            joinedAt: customer?.createdAt || new Date().toISOString(),
            pointsHistory: [],
          };
        });

        const mappedRewards: LoyaltyReward[] = (coupons || []).map((coupon: any) => ({
          id: coupon?.id,
          nameAr: coupon?.nameAr || coupon?.code || 'كوبون',
          nameEn: coupon?.nameEn || coupon?.code || 'Coupon',
          descriptionAr: coupon?.nameAr || coupon?.code || 'خصم',
          descriptionEn: coupon?.nameEn || coupon?.code || 'Discount',
          pointsCost: Math.max(50, Math.floor(Number(coupon?.discountValue || 10) * 10)),
          discountType:
            coupon?.discountType === 'fixed'
              ? 'fixed'
              : coupon?.discountType === 'percentage'
                ? 'percentage'
                : 'fixed',
          discountValue: Number(coupon?.discountValue || 0),
          isActive: coupon?.isActive !== false,
        }));

        setProfiles(mappedProfiles);
        setRewards(mappedRewards.filter((reward) => reward.isActive));
      } catch (e: any) {
        console.error('Failed to load loyalty data', e);
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          e?.message || (language === 'ar' ? 'فشل في تحميل بيانات الولاء' : 'Failed to load loyalty data')
        );
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    loadLoyaltyData();
  }, [language]);

  const filteredProfiles = profiles.filter((p) => {
    const normalizedSearch = search.toLowerCase();
    const matchSearch =
      p.customerName.toLowerCase().includes(normalizedSearch) ||
      p.phone.includes(search);
    const matchFilter = filter === 'all' || p.tier === filter;
    return matchSearch && matchFilter;
  });

  const totalMembers = profiles.length;
  const totalPointsIssued = profiles.reduce((sum, p) => sum + p.totalPoints, 0);
  const tierCounts = {
    vip: profiles.filter((p) => p.tier === 'vip').length,
    gold: profiles.filter((p) => p.tier === 'gold').length,
    silver: profiles.filter((p) => p.tier === 'silver').length,
    bronze: profiles.filter((p) => p.tier === 'bronze').length,
  };

  const getTierProgress = (profile: LoyaltyProfile): number => {
    const config = TIER_CONFIG[profile.tier];
    if (profile.tier === 'vip') return 1;
    return Math.min(profile.totalPoints / config.nextPoints, 1);
  };

  const getTierLabel = (tier: LoyaltyTier): string => {
    const labels: Record<LoyaltyTier, string> = {
      vip: 'VIP',
      gold: language === 'ar' ? 'ذهبي' : 'Gold',
      silver: language === 'ar' ? 'فضي' : 'Silver',
      bronze: language === 'ar' ? 'برونزي' : 'Bronze',
    };
    return labels[tier];
  };

  const getPointTypeIcon = (type: PointsTransaction['type']): string => {
    switch (type) {
      case 'earned': return 'add-circle';
      case 'redeemed': return 'gift';
      case 'expired': return 'time';
      case 'bonus': return 'star';
      default: return 'ellipse';
    }
  };

  const getPointTypeColor = (type: PointsTransaction['type']): string => {
    switch (type) {
      case 'earned': return colors.emerald;
      case 'redeemed': return colors.blue;
      case 'expired': return colors.rose;
      case 'bonus': return colors.amber;
      default: return colors.textMuted;
    }
  };

  const openProfile = (profile: LoyaltyProfile) => {
    setSelectedProfile(profile);
    setShowProfileModal(true);
  };

  const openRedeem = (profile: LoyaltyProfile) => {
    setRedeemProfile(profile);
    setShowRedeemModal(true);
  };

  const handleRedeem = async (reward: LoyaltyReward) => {
    if (!redeemProfile) return;
    if (redeemProfile.availablePoints < reward.pointsCost) {
      Alert.alert(
        language === 'ar' ? 'نقاط غير كافية' : 'Insufficient Points',
        language === 'ar' ? 'لا تملك نقاط كافية لهذه المكافأة' : 'Not enough points for this reward'
      );
      return;
    }

    Alert.alert(
      language === 'ar' ? 'تأكيد الاستبدال' : 'Confirm Redemption',
      language === 'ar'
        ? `استبدال ${reward.pointsCost} نقطة مقابل "${reward.nameAr}"؟`
        : `Redeem ${reward.pointsCost} points for "${reward.nameEn}"?`,
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'استبدال' : 'Redeem',
          onPress: async () => {
            try {
              // @ts-ignore
              if (api.loyalty && api.loyalty.addTransaction) {
                 // @ts-ignore
                 await api.loyalty.addTransaction({
                  customerId: redeemProfile.customerId,
                  type: 'redeemed',
                  points: reward.pointsCost,
                  notes: `Redeemed for ${language === 'ar' ? reward.nameAr : reward.nameEn}`
                });
              }
              
              // Update local state to reflect change immediately
              setProfiles(prev => prev.map(p => {
                if (p.customerId === redeemProfile.customerId) {
                  return {
                    ...p,
                    availablePoints: p.availablePoints - reward.pointsCost
                  };
                }
                return p;
              }));

              Alert.alert(
                language === 'ar' ? 'تم!' : 'Done!',
                language === 'ar' ? 'تم استبدال المكافأة بنجاح' : 'Reward redeemed successfully'
              );
              setShowRedeemModal(false);
            } catch (e) {
              console.error('Redemption failed', e);
              Alert.alert(t('error'), 'Redemption failed');
            }
          },
        },
      ]
    );
  };

  const s = dynStyles(colors, isRTL);

  const renderSummaryCards = () => (
    <View style={s.summaryRow}>
      <View style={[s.summaryCard, { borderColor: colors.primaryGlow }]}>
        <Ionicons name="people" size={20} color={colors.primaryLight} />
        <Text style={s.summaryValue} data-testid="text-total-members">{totalMembers}</Text>
        <Text style={s.summaryLabel}>{language === 'ar' ? 'الأعضاء' : 'Members'}</Text>
      </View>
      <View style={[s.summaryCard, { borderColor: colors.amberBorder }]}>
        <Ionicons name="diamond" size={20} color={colors.amber} />
        <Text style={s.summaryValue} data-testid="text-total-points">{totalPointsIssued.toLocaleString()}</Text>
        <Text style={s.summaryLabel}>{language === 'ar' ? 'إجمالي النقاط' : 'Total Points'}</Text>
      </View>
      <View style={[s.summaryCard, { borderColor: 'rgba(167,139,250,0.2)' }]}>
        <Text style={{ fontSize: 18 }}>💎</Text>
        <Text style={s.summaryValue} data-testid="text-vip-count">{tierCounts.vip}</Text>
        <Text style={s.summaryLabel}>VIP</Text>
      </View>
    </View>
  );

  const renderTierFilters = () => {
    const filters: { key: FilterKey; label: string; count?: number }[] = [
      { key: 'all', label: language === 'ar' ? 'الكل' : 'All', count: totalMembers },
      { key: 'vip', label: 'VIP', count: tierCounts.vip },
      { key: 'gold', label: language === 'ar' ? 'ذهبي' : 'Gold', count: tierCounts.gold },
      { key: 'silver', label: language === 'ar' ? 'فضي' : 'Silver', count: tierCounts.silver },
      { key: 'bronze', label: language === 'ar' ? 'برونزي' : 'Bronze', count: tierCounts.bronze },
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filtersRow}
      >
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, filter === f.key && s.filterChipActive]}
            onPress={() => setFilter(f.key)}
            data-testid={`button-filter-${f.key}`}
          >
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>
              {f.label} ({f.count})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderProfileCard = ({ item }: { item: LoyaltyProfile }) => {
    const tierConfig = TIER_CONFIG[item.tier];
    const progress = getTierProgress(item);

    return (
      <TouchableOpacity
        style={s.profileCard}
        onPress={() => openProfile(item)}
        data-testid={`card-loyalty-${item.customerId}`}
      >
        <View style={s.profileRow}>
          <View style={[s.tierBadge, { backgroundColor: tierConfig.color + '20', borderColor: tierConfig.color + '40' }]}>
            <Text style={{ fontSize: 22 }}>{tierConfig.icon}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName} data-testid={`text-loyalty-name-${item.customerId}`}>{item.customerName}</Text>
            <View style={s.profileMeta}>
              <Text style={[s.tierTag, { color: tierConfig.color }]}>{getTierLabel(item.tier)}</Text>
              <Text style={s.profilePhone}>{item.phone}</Text>
            </View>
          </View>
          <View style={s.pointsCol}>
            <Text style={s.pointsValue} data-testid={`text-points-${item.customerId}`}>{item.availablePoints.toLocaleString()}</Text>
            <Text style={s.pointsLabel}>{language === 'ar' ? 'نقطة' : 'pts'}</Text>
          </View>
        </View>

        <View style={s.progressSection}>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${progress * 100}%`, backgroundColor: tierConfig.color }]} />
          </View>
          {item.tier !== 'vip' && (
            <Text style={s.progressText}>
              {item.totalPoints.toLocaleString()} / {tierConfig.nextPoints.toLocaleString()} {language === 'ar' ? `لـ ${getTierLabel(item.tier === 'bronze' ? 'silver' : item.tier === 'silver' ? 'gold' : 'vip')}` : `to ${tierConfig.nextTier}`}
            </Text>
          )}
          {item.tier === 'vip' && (
            <Text style={s.progressText}>{language === 'ar' ? 'أعلى مستوى ✨' : 'Max Tier ✨'}</Text>
          )}
        </View>

        <View style={s.profileStatsRow}>
          <View style={s.profileStat}>
            <Ionicons name="receipt-outline" size={14} color={colors.textMuted} />
            <Text style={s.profileStatText}>{item.totalVisits} {language === 'ar' ? 'زيارة' : 'visits'}</Text>
          </View>
          <View style={s.profileStat}>
            <Ionicons name="wallet-outline" size={14} color={colors.textMuted} />
            <Text style={s.profileStatText}>{item.totalSpent} {language === 'ar' ? 'ر.س' : 'SAR'}</Text>
          </View>
          <TouchableOpacity
            style={s.redeemBtn}
            onPress={() => openRedeem(item)}
            data-testid={`button-redeem-${item.customerId}`}
          >
            <Ionicons name="gift-outline" size={14} color={colors.primary} />
            <Text style={s.redeemBtnText}>{language === 'ar' ? 'استبدال' : 'Redeem'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRewardCard = ({ item }: { item: LoyaltyReward }) => {
    const discountLabel = item.discountType === 'percentage'
      ? `${item.discountValue}%`
      : item.discountType === 'fixed'
      ? `${item.discountValue} ${language === 'ar' ? 'ر.س' : 'SAR'}`
      : language === 'ar' ? 'مجاني' : 'Free';

    return (
      <View style={s.rewardCard} data-testid={`card-reward-${item.id}`}>
        <View style={s.rewardHeader}>
          <View style={s.rewardIconWrap}>
            <Ionicons name="gift" size={24} color={colors.primary} />
          </View>
          <View style={s.rewardInfo}>
            <Text style={s.rewardName}>{language === 'ar' ? item.nameAr : item.nameEn}</Text>
            <Text style={s.rewardDesc}>{language === 'ar' ? item.descriptionAr : item.descriptionEn}</Text>
          </View>
        </View>
        <View style={s.rewardFooter}>
          <View style={s.rewardCost}>
            <Ionicons name="diamond-outline" size={14} color={colors.amber} />
            <Text style={s.rewardCostText}>{item.pointsCost} {language === 'ar' ? 'نقطة' : 'pts'}</Text>
          </View>
          <View style={s.rewardDiscountBadge}>
            <Text style={s.rewardDiscountText}>{discountLabel}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <DrawerMenuButton />
          <Text style={s.title}>{language === 'ar' ? 'الولاء والعملاء' : 'Loyalty & CRM'}</Text>
        </View>

        <View style={s.tabsRow}>
          <TouchableOpacity
            style={[s.tab, activeTab === 'customers' && s.tabActive]}
            onPress={() => setActiveTab('customers')}
            data-testid="button-tab-customers"
          >
            <Ionicons name="people-outline" size={16} color={activeTab === 'customers' ? colors.primary : colors.textMuted} />
            <Text style={[s.tabText, activeTab === 'customers' && s.tabTextActive]}>
              {language === 'ar' ? 'الأعضاء' : 'Members'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, activeTab === 'rewards' && s.tabActive]}
            onPress={() => setActiveTab('rewards')}
            data-testid="button-tab-rewards"
          >
            <Ionicons name="gift-outline" size={16} color={activeTab === 'rewards' ? colors.primary : colors.textMuted} />
            <Text style={[s.tabText, activeTab === 'rewards' && s.tabTextActive]}>
              {language === 'ar' ? 'المكافآت' : 'Rewards'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'customers' && (
        <>
          <ScrollView
            style={s.scrollBody}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadLoyaltyData} />}
          >
            {renderSummaryCards()}

            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{language === 'ar' ? 'الأعضاء' : 'Members'}</Text>
            </View>

            <View style={s.searchBox}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={s.searchInput}
                placeholder={language === 'ar' ? 'بحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
                placeholderTextColor={colors.textDark}
                value={search}
                onChangeText={setSearch}
                data-testid="input-search-loyalty"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} data-testid="button-clear-loyalty-search">
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {renderTierFilters()}

            {filteredProfiles.map((profile) => (
              <View key={profile.customerId}>
                {renderProfileCard({ item: profile })}
              </View>
            ))}

            {filteredProfiles.length === 0 && (
              <View style={s.empty}>
                <Ionicons name="people-outline" size={48} color={colors.textDark} />
                <Text style={s.emptyText}>
                  {isLoading
                    ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...')
                    : (language === 'ar' ? 'لا يوجد أعضاء' : 'No members found')}
                </Text>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}

      {activeTab === 'rewards' && (
        <FlatList
          data={rewards.filter((r) => r.isActive)}
          keyExtractor={(item) => item.id}
          renderItem={renderRewardCard}
          contentContainerStyle={s.rewardsList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.rewardsHeaderCard}>
              <Ionicons name="gift" size={32} color={colors.primary} />
              <Text style={s.rewardsHeaderTitle}>
                {language === 'ar' ? 'كتالوج المكافآت' : 'Rewards Catalog'}
              </Text>
              <Text style={s.rewardsHeaderSub}>
                {language === 'ar' ? 'استبدل نقاطك بمكافآت حصرية' : 'Redeem your points for exclusive rewards'}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="gift-outline" size={48} color={colors.textDark} />
              <Text style={s.emptyText}>{language === 'ar' ? 'لا توجد مكافآت' : 'No rewards available'}</Text>
            </View>
          }
        />
      )}

      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowProfileModal(false)} data-testid="button-close-profile">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>{language === 'ar' ? 'ملف العضو' : 'Member Profile'}</Text>
              <View style={{ width: 24 }} />
            </View>

            {selectedProfile && (
              <ScrollView style={s.detailsScroll} showsVerticalScrollIndicator={false}>
                <View style={s.profileDetailHeader}>
                  <View style={[s.detailTierBadge, { backgroundColor: TIER_CONFIG[selectedProfile.tier].color + '20', borderColor: TIER_CONFIG[selectedProfile.tier].color + '40' }]}>
                    <Text style={{ fontSize: 36 }}>{TIER_CONFIG[selectedProfile.tier].icon}</Text>
                  </View>
                  <Text style={s.detailName}>{selectedProfile.customerName}</Text>
                  <Text style={[s.detailTierText, { color: TIER_CONFIG[selectedProfile.tier].color }]}>
                    {getTierLabel(selectedProfile.tier)}
                  </Text>
                </View>

                <View style={s.detailStatsRow}>
                  <View style={s.detailStatCard}>
                    <Ionicons name="diamond" size={20} color={colors.amber} />
                    <Text style={s.detailStatValue} data-testid="text-detail-available-points">{selectedProfile.availablePoints.toLocaleString()}</Text>
                    <Text style={s.detailStatLabel}>{language === 'ar' ? 'نقاط متاحة' : 'Available'}</Text>
                  </View>
                  <View style={s.detailStatCard}>
                    <Ionicons name="trending-up" size={20} color={colors.emerald} />
                    <Text style={s.detailStatValue}>{selectedProfile.totalPoints.toLocaleString()}</Text>
                    <Text style={s.detailStatLabel}>{language === 'ar' ? 'إجمالي مكتسب' : 'Total Earned'}</Text>
                  </View>
                  <View style={s.detailStatCard}>
                    <Ionicons name="receipt" size={20} color={colors.blue} />
                    <Text style={s.detailStatValue}>{selectedProfile.totalVisits}</Text>
                    <Text style={s.detailStatLabel}>{language === 'ar' ? 'زيارات' : 'Visits'}</Text>
                  </View>
                </View>

                <View style={s.detailSection}>
                  <Text style={s.detailSectionTitle}>{language === 'ar' ? 'تقدم المستوى' : 'Tier Progress'}</Text>
                  <View style={s.progressBarLarge}>
                    <View style={[s.progressFillLarge, { width: `${getTierProgress(selectedProfile) * 100}%`, backgroundColor: TIER_CONFIG[selectedProfile.tier].color }]} />
                  </View>
                  {selectedProfile.tier !== 'vip' ? (
                    <Text style={s.progressDetailText}>
                      {selectedProfile.totalPoints.toLocaleString()} / {TIER_CONFIG[selectedProfile.tier].nextPoints.toLocaleString()} {language === 'ar' ? 'نقطة' : 'points'}
                    </Text>
                  ) : (
                    <Text style={s.progressDetailText}>{language === 'ar' ? 'أعلى مستوى! ✨' : 'Highest Tier! ✨'}</Text>
                  )}
                </View>

                <View style={s.detailSection}>
                  <Text style={s.detailSectionTitle}>{language === 'ar' ? 'سجل النقاط' : 'Points History'}</Text>
                  {selectedProfile.pointsHistory.map((tx) => (
                    <View key={tx.id} style={s.historyItem} data-testid={`history-item-${tx.id}`}>
                      <View style={[s.historyIcon, { backgroundColor: getPointTypeColor(tx.type) + '20' }]}>
                        <Ionicons name={getPointTypeIcon(tx.type) as any} size={16} color={getPointTypeColor(tx.type)} />
                      </View>
                      <View style={s.historyInfo}>
                        <Text style={s.historyDesc}>{tx.description}</Text>
                        <Text style={s.historyDate}>
                          {new Date(tx.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </Text>
                      </View>
                      <Text style={[s.historyPoints, { color: tx.points > 0 ? colors.emerald : colors.rose }]}>
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={s.detailSection}>
                  <View style={s.detailInfoRow}>
                    <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                    <Text style={s.detailInfoText}>{selectedProfile.phone}</Text>
                  </View>
                  <View style={s.detailInfoRow}>
                    <Ionicons name="wallet-outline" size={16} color={colors.textMuted} />
                    <Text style={s.detailInfoText}>
                      {language === 'ar' ? 'إجمالي الإنفاق:' : 'Total Spent:'} {selectedProfile.totalSpent} {language === 'ar' ? 'ر.س' : 'SAR'}
                    </Text>
                  </View>
                  <View style={s.detailInfoRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={s.detailInfoText}>
                      {language === 'ar' ? 'انضم:' : 'Joined:'} {new Date(selectedProfile.joinedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={s.redeemLargeBtn}
                  onPress={() => {
                    setShowProfileModal(false);
                    openRedeem(selectedProfile);
                  }}
                  data-testid="button-redeem-from-profile"
                >
                  <Ionicons name="gift" size={20} color={colors.white} />
                  <Text style={s.redeemLargeBtnText}>{language === 'ar' ? 'استبدال النقاط' : 'Redeem Points'}</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showRedeemModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowRedeemModal(false)} data-testid="button-close-redeem">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>{language === 'ar' ? 'استبدال النقاط' : 'Redeem Points'}</Text>
              <View style={{ width: 24 }} />
            </View>

            {redeemProfile && (
              <ScrollView style={s.detailsScroll} showsVerticalScrollIndicator={false}>
                <View style={s.redeemBalanceCard}>
                  <Text style={s.redeemBalanceLabel}>
                    {language === 'ar' ? 'النقاط المتاحة لـ' : 'Available points for'} {redeemProfile.customerName}
                  </Text>
                  <Text style={s.redeemBalanceValue} data-testid="text-redeem-balance">
                    {redeemProfile.availablePoints.toLocaleString()}
                  </Text>
                </View>

                {rewards.filter((r) => r.isActive).map((reward) => {
                  const canAfford = redeemProfile.availablePoints >= reward.pointsCost;
                  return (
                    <TouchableOpacity
                      key={reward.id}
                      style={[s.redeemRewardCard, !canAfford && s.redeemRewardDisabled]}
                      onPress={() => canAfford && handleRedeem(reward)}
                      disabled={!canAfford}
                      data-testid={`button-redeem-reward-${reward.id}`}
                    >
                      <View style={s.redeemRewardRow}>
                        <View style={s.redeemRewardIcon}>
                          <Ionicons name="gift" size={20} color={canAfford ? colors.primary : colors.textDark} />
                        </View>
                        <View style={s.redeemRewardInfo}>
                          <Text style={[s.redeemRewardName, !canAfford && { color: colors.textDark }]}>
                            {language === 'ar' ? reward.nameAr : reward.nameEn}
                          </Text>
                          <Text style={s.redeemRewardDesc}>
                            {language === 'ar' ? reward.descriptionAr : reward.descriptionEn}
                          </Text>
                        </View>
                        <View style={[s.redeemCostBadge, canAfford ? { backgroundColor: colors.emeraldBg, borderColor: colors.emeraldBorder } : { backgroundColor: colors.roseBg, borderColor: colors.roseBorder }]}>
                          <Text style={[s.redeemCostText, { color: canAfford ? colors.emerald : colors.rose }]}>
                            {reward.pointsCost}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const dynStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 20,
    paddingBottom: 0,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.white, textAlign: isRTL ? 'right' : 'left' },
  tabsRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 0,
  },
  tab: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  scrollBody: { flex: 1, paddingHorizontal: 16 },
  summaryRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  summaryValue: { fontSize: 20, fontWeight: '900', color: colors.white },
  summaryLabel: { fontSize: 10, color: colors.textMuted },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    textAlign: isRTL ? 'right' : 'left',
  },
  searchBox: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: colors.text,
    fontSize: 14,
    textAlign: isRTL ? 'right' : 'left',
  },
  filtersRow: {
    paddingBottom: 12,
    gap: 8,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primaryGlow,
    borderColor: colors.primary,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.primaryLight },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 4,
  },
  profileMeta: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierTag: { fontSize: 12, fontWeight: '800' },
  profilePhone: { fontSize: 12, color: colors.textMuted },
  pointsCol: { alignItems: 'center' },
  pointsValue: { fontSize: 20, fontWeight: '900', color: colors.amber },
  pointsLabel: { fontSize: 10, color: colors.textMuted },
  progressSection: { marginTop: 12 },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: { fontSize: 10, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left' },
  profileStatsRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 16,
  },
  profileStat: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileStatText: { fontSize: 12, color: colors.textMuted },
  redeemBtn: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: isRTL ? 0 : 'auto',
    marginRight: isRTL ? 'auto' : 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primaryGlow,
  },
  redeemBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 12 },
  rewardsList: { padding: 16 },
  rewardsHeaderCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryGlow,
    padding: 24,
    marginBottom: 16,
    gap: 8,
  },
  rewardsHeaderTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  rewardsHeaderSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  rewardCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  rewardHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 12,
    marginBottom: 12,
  },
  rewardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardInfo: { flex: 1 },
  rewardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 4,
  },
  rewardDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: isRTL ? 'right' : 'left',
  },
  rewardFooter: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rewardCost: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardCostText: { fontSize: 14, fontWeight: '700', color: colors.amber },
  rewardDiscountBadge: {
    backgroundColor: colors.emeraldBg,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.emeraldBorder,
  },
  rewardDiscountText: { fontSize: 13, fontWeight: '800', color: colors.emerald },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  detailsScroll: { paddingHorizontal: 20, paddingTop: 16 },
  profileDetailHeader: { alignItems: 'center', marginBottom: 20 },
  detailTierBadge: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  detailName: { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: 4 },
  detailTierText: { fontSize: 16, fontWeight: '800' },
  detailStatsRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
    marginBottom: 20,
  },
  detailStatCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
  },
  detailStatValue: { fontSize: 18, fontWeight: '900', color: colors.white, marginTop: 6 },
  detailStatLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  detailSection: {
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 10,
  },
  progressBarLarge: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFillLarge: {
    height: '100%',
    borderRadius: 5,
  },
  progressDetailText: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  historyItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInfo: { flex: 1 },
  historyDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: isRTL ? 'right' : 'left',
  },
  historyDate: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: isRTL ? 'right' : 'left',
    marginTop: 2,
  },
  historyPoints: { fontSize: 16, fontWeight: '900' },
  detailInfoRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailInfoText: { fontSize: 14, color: colors.text, textAlign: isRTL ? 'right' : 'left' },
  redeemLargeBtn: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  redeemLargeBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },
  redeemBalanceCard: {
    alignItems: 'center',
    backgroundColor: colors.amberBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    padding: 20,
    marginBottom: 16,
  },
  redeemBalanceLabel: { fontSize: 13, color: colors.amber, marginBottom: 4 },
  redeemBalanceValue: { fontSize: 36, fontWeight: '900', color: colors.amber },
  redeemRewardCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  redeemRewardDisabled: { opacity: 0.5 },
  redeemRewardRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
  },
  redeemRewardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemRewardInfo: { flex: 1 },
  redeemRewardName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 2,
  },
  redeemRewardDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: isRTL ? 'right' : 'left',
  },
  redeemCostBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  redeemCostText: { fontSize: 14, fontWeight: '800' },
});
