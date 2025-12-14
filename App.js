import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Dimensions,
} from 'react-native';

const screenWidth = Dimensions.get('window').width;

// Top 5 European Leagues
const LEAGUES = [
  { id: 'PL', name: 'Premier League', country: 'England', code: 'PL' },
  { id: 'PD', name: 'La Liga', country: 'Spain', code: 'PD' },
  { id: 'SA', name: 'Serie A', country: 'Italy', code: 'SA' },
  { id: 'BL1', name: 'Bundesliga', country: 'Germany', code: 'BL1' },
  { id: 'FL1', name: 'Ligue 1', country: 'France', code: 'FL1' },
];

const App = () => {
  const [selectedLeague, setSelectedLeague] = useState(LEAGUES[0]);
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' or 'standings'
  const [usingMockData, setUsingMockData] = useState(true); // Start as true, will be set to false when real data loads
  const [matchesFromAPI, setMatchesFromAPI] = useState(false);
  const [standingsFromAPI, setStandingsFromAPI] = useState(false);

  useEffect(() => {
    // Reset API flags when league changes
    setMatchesFromAPI(false);
    setStandingsFromAPI(false);
    setUsingMockData(true);
    fetchData();
  }, [selectedLeague]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch both in parallel
      await Promise.all([
        fetchMatches(),
        fetchStandings(),
      ]);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      // Final check: if neither matches nor standings came from API, show demo mode
      setTimeout(() => {
        setUsingMockData(!matchesFromAPI && !standingsFromAPI);
      }, 100);
    }
  };

  const fetchMatches = async () => {
    const API_TOKEN = '7d1b4e5bbff44624831ebaac0d216ef5';
    const leagueCode = selectedLeague.code;
    
    console.log(`🔵 Fetching matches for league: ${leagueCode} (${selectedLeague.name})`);
    console.log(`🔵 Using API token: ${API_TOKEN.substring(0, 10)}...`);
    
    try {
      // Get date range for recent matches (last 7 days to next 7 days)
      const today = new Date();
      const dateFrom = new Date(today);
      dateFrom.setDate(dateFrom.getDate() - 7);
      const dateTo = new Date(today);
      dateTo.setDate(dateTo.getDate() + 7);
      
      const dateFromStr = dateFrom.toISOString().split('T')[0];
      const dateToStr = dateTo.toISOString().split('T')[0];
      
      // Primary method: Competition-specific endpoint with date range
      try {
        const competitionUrl = `https://api.football-data.org/v4/competitions/${leagueCode}/matches?dateFrom=${dateFromStr}&dateTo=${dateToStr}&status=SCHEDULED,LIVE,FINISHED&limit=30`;
        
        console.log(`Fetching from: ${competitionUrl}`);
        
        const response = await fetch(competitionUrl, {
          headers: {
            'X-Auth-Token': API_TOKEN,
          },
        });
        
        console.log(`Response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('API Response received:', {
            matchesCount: data.matches?.length || 0,
            competition: data.competition?.name,
          });
          
          if (data.matches && Array.isArray(data.matches) && data.matches.length > 0) {
            console.log(`✅ Successfully fetched ${data.matches.length} matches from API for ${selectedLeague.name}`);
            setMatches(data.matches);
            setMatchesFromAPI(true);
            // Update usingMockData immediately when we get real data
            setUsingMockData(false);
            return;
          } else {
            console.log('API returned empty matches array, trying without date filter...');
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ API Error ${response.status}:`, errorText);
          
          if (response.status === 429) {
            console.log('Rate limit exceeded');
          } else if (response.status === 403 || response.status === 401) {
            console.log('Authentication failed');
          }
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError.message);
      }
      
      // Try without date filter
      try {
        const competitionUrl = `https://api.football-data.org/v4/competitions/${leagueCode}/matches?status=SCHEDULED,LIVE,FINISHED&limit=30`;
        
        const response = await fetch(competitionUrl, {
          headers: {
            'X-Auth-Token': API_TOKEN,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.matches && Array.isArray(data.matches) && data.matches.length > 0) {
            console.log(`✅ Fetched ${data.matches.length} matches without date filter`);
            setMatches(data.matches);
            setMatchesFromAPI(true);
            setUsingMockData(false);
            return;
          }
        }
      } catch (error) {
        console.log('Fallback 1 failed:', error.message);
      }
      
      // Try /v4/matches endpoint
      try {
        const matchesUrl = `https://api.football-data.org/v4/matches?competitions=${leagueCode}&status=SCHEDULED,LIVE,FINISHED&limit=30`;
        
        const response = await fetch(matchesUrl, {
          headers: {
            'X-Auth-Token': API_TOKEN,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.matches && Array.isArray(data.matches) && data.matches.length > 0) {
            // Filter by competition code
            const filteredMatches = data.matches.filter(
              match => match.competition?.code === leagueCode
            );
            
            if (filteredMatches.length > 0) {
              console.log(`✅ Fetched ${filteredMatches.length} matches from /v4/matches`);
              setMatches(filteredMatches);
              setMatchesFromAPI(true);
              setUsingMockData(false);
              return;
            }
          }
        }
      } catch (error) {
        console.log('Fallback 2 failed:', error.message);
      }
      
      // If all API calls fail, use mock data
      console.warn('⚠️ All API calls failed, using mock data for', selectedLeague.name);
      setMatches(getMockMatches());
      setMatchesFromAPI(false);
      
    } catch (error) {
      console.error('❌ Error fetching matches:', error);
      setMatches(getMockMatches());
      setMatchesFromAPI(false);
      
    }
  };

  const fetchStandings = async () => {
    const API_TOKEN = '7d1b4e5bbff44624831ebaac0d216ef5';
    const leagueCode = selectedLeague.code;
    
    console.log(`Fetching standings for league: ${leagueCode} (${selectedLeague.name})`);
    
    try {
      //Football-Data.org standings
      try {
        const apiUrl = `https://api.football-data.org/v4/competitions/${leagueCode}/standings`;
        
        console.log(`Fetching standings from: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          headers: {
            'X-Auth-Token': API_TOKEN,
          },
        });
        
        console.log(`Standings response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Standings API Response received:', {
            standingsCount: data.standings?.length || 0,
            competition: data.competition?.name,
          });
          
          if (data.standings && data.standings.length > 0) {
            const table = data.standings[0].table || [];
            if (table.length > 0) {
              console.log(`✅ Successfully fetched ${table.length} teams from standings API for ${selectedLeague.name}`);
              setStandings(table);
              setStandingsFromAPI(true);
              setUsingMockData(false);
              return;
            }
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ Standings API Error ${response.status}:`, errorText);
        }
      } catch (error) {
        console.error('Standings fetch error:', error.message);
      }
      
      // Fallback: Try OpenLigaDB for Bundesliga
      if (leagueCode === 'BL1') {
        try {
          const currentYear = new Date().getFullYear();
          const currentSeason = `${currentYear - 1}/${currentYear}`;
          const openLigaUrl = `https://api.openligadb.net/getbltable/${currentSeason}`;
          const response = await fetch(openLigaUrl);
          
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              const formattedStandings = data.map((team) => ({
                position: team.rank || team.position,
                team: { name: team.teamName || team.team?.name },
                playedGames: team.matches || team.playedGames,
                won: team.won || team.wins,
                draw: team.draw || team.draws,
                lost: team.lost || team.losses,
                points: team.points,
                goalDifference: team.goalDiff || team.goalDifference,
              }));
              console.log(`✅ Fetched ${formattedStandings.length} teams from OpenLigaDB`);
              setStandings(formattedStandings);
              setStandingsFromAPI(true);
              setUsingMockData(false);
              return;
            }
          }
        } catch (openLigaError) {
          console.log('OpenLigaDB failed:', openLigaError.message);
        }
      }
      
      // Fallback to mock data
      console.warn('⚠️ All standings API calls failed, using mock data for', selectedLeague.name);
      setStandings(getMockStandings());
      setStandingsFromAPI(false);
      // Set usingMockData based on whether we got any real data
      setUsingMockData(!matchesFromAPI && !standingsFromAPI);
    } catch (error) {
      console.error('❌ Error fetching standings:', error);
      setStandings(getMockStandings());
      setStandingsFromAPI(false);
      // Set usingMockData based on whether we got any real data
      setUsingMockData(!matchesFromAPI && !standingsFromAPI);
    }
  };

  const getMockMatches = () => {
    const teams = [
      ['Arsenal', 'Chelsea'],
      ['Manchester City', 'Liverpool'],
      ['Barcelona', 'Real Madrid'],
      ['Bayern Munich', 'Borussia Dortmund'],
      ['PSG', 'Marseille'],
    ];
    
    const statuses = ['FINISHED', 'LIVE', 'SCHEDULED'];
    const now = new Date();
    
    return teams.map(([home, away], index) => {
      const matchDate = new Date(now);
      matchDate.setDate(matchDate.getDate() + index - 2);
      
      return {
        id: index + 1,
        homeTeam: { name: home },
        awayTeam: { name: away },
        score: {
          fullTime: {
            home: statuses[index % 3] === 'FINISHED' ? Math.floor(Math.random() * 4) : null,
            away: statuses[index % 3] === 'FINISHED' ? Math.floor(Math.random() * 4) : null,
          },
        },
        status: statuses[index % 3],
        utcDate: matchDate.toISOString(),
      };
    });
  };

  const getMockStandings = () => {
    // Real team names organized by league
    const leagueStandings = {
      'PL': [
        'Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Tottenham',
        'Newcastle', 'Brighton', 'Aston Villa', 'West Ham', 'Crystal Palace',
        'Fulham', 'Everton', 'Wolves', 'Brentford', 'Nottingham Forest',
      ],
      'PD': [
        'Barcelona', 'Real Madrid', 'Atletico Madrid', 'Sevilla', 'Real Sociedad',
        'Villarreal', 'Valencia', 'Athletic Bilbao', 'Real Betis', 'Osasuna',
        'Getafe', 'Mallorca', 'Celta Vigo', 'Rayo Vallecano', 'Girona',
      ],
      'SA': [
        'Juventus', 'AC Milan', 'Inter Milan', 'Napoli', 'Roma',
        'Lazio', 'Atalanta', 'Fiorentina', 'Torino', 'Bologna',
        'Udinese', 'Sassuolo', 'Genoa', 'Lecce', 'Verona',
      ],
      'BL1': [
        'Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen', 'Eintracht Frankfurt',
        'Wolfsburg', 'Borussia Mönchengladbach', 'Union Berlin', 'Freiburg', 'Hoffenheim',
        'Mainz', 'Augsburg', 'Werder Bremen', 'Stuttgart', 'Bochum',
      ],
      'FL1': [
        'PSG', 'Marseille', 'Lyon', 'Monaco', 'Nice',
        'Lille', 'Lens', 'Rennes', 'Toulouse', 'Montpellier',
        'Nantes', 'Strasbourg', 'Reims', 'Brest', 'Lorient',
      ],
    };
    
    const teams = leagueStandings[selectedLeague.code] || leagueStandings['PL'];
    
    return teams.slice(0, 15).map((name, index) => ({
      position: index + 1,
      team: { name },
      playedGames: 20,
      won: Math.max(1, 15 - index),
      draw: 3 + (index % 3),
      lost: Math.max(0, index - 2),
      points: (Math.max(1, 15 - index) * 3) + (3 + (index % 3)),
      goalDifference: 25 - index * 2,
    }));
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getStatusColor = (status) => {
    if (status === 'LIVE') return '#e74c3c';
    if (status === 'FINISHED') return '#27ae60';
    return '#95a5a6';
  };

  const getStatusText = (status) => {
    if (status === 'LIVE') return 'LIVE';
    if (status === 'FINISHED') return 'FT';
    return formatTime(new Date().toISOString());
  };

  // Remove "FC" and other common suffixes from team names so to fit.
  const cleanTeamName = (name) => {
    if (!name) return name;
    return name
      .replace(/\s+FC\s*$/i, '')  
      .replace(/\s+FC\s+/i, ' ')   
      .replace(/\s+CF\s*$/i, '')   
      .replace(/\s+CF\s+/i, ' ')   
      .trim();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Score</Text>
        <Text style={styles.subtitle}>Football Scores, Fixtures and Standings</Text>
      </View>

      {/* League Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.leagueSelector}
        contentContainerStyle={styles.leagueSelectorContent}
      >
        {LEAGUES.map((league) => (
          <TouchableOpacity
            key={league.id}
            style={[
              styles.leagueButton,
              selectedLeague.id === league.id && styles.leagueButtonActive,
            ]}
            onPress={() => setSelectedLeague(league)}
          >
            <Text
              style={[
                styles.leagueButtonText,
                selectedLeague.id === league.id && styles.leagueButtonTextActive,
              ]}
            >
              {league.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>
            Matches
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'standings' && styles.tabActive]}
          onPress={() => setActiveTab('standings')}
        >
          <Text style={[styles.tabText, activeTab === 'standings' && styles.tabTextActive]}>
            Standings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {activeTab === 'matches' ? (
            <View style={styles.matchesContainer}>
              {matches.map((match) => (
                <View key={match.id} style={styles.matchCard}>
                  <View style={styles.matchHeader}>
                    <Text style={styles.matchDate}>
                      {formatDate(match.utcDate)} • {formatTime(match.utcDate)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(match.status) }]}>
                      <Text style={styles.statusText}>{getStatusText(match.status)}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.matchContent}>
                    <View style={styles.teamContainer}>
                      <Text style={styles.teamName} numberOfLines={1}>
                        {cleanTeamName(match.homeTeam?.name) || 'Home Team'}
                      </Text>
                      <Text style={styles.score}>
                        {match.score?.fullTime?.home !== null 
                          ? match.score.fullTime.home 
                          : '-'}
                      </Text>
                    </View>
                    
                    <View style={styles.vsContainer}>
                      <Text style={styles.vs}>vs</Text>
                    </View>
                    
                    <View style={styles.teamContainer}>
                      <Text style={styles.teamName} numberOfLines={1}>
                        {cleanTeamName(match.awayTeam?.name) || 'Away Team'}
                      </Text>
                      <Text style={styles.score}>
                        {match.score?.fullTime?.away !== null 
                          ? match.score.fullTime.away 
                          : '-'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.standingsContainer}>
              <View style={styles.standingsHeader}>
                <Text style={styles.standingsHeaderText}>Pos</Text>
                <Text style={[styles.standingsHeaderText, styles.teamHeaderText]}>Team</Text>
                <Text style={styles.standingsHeaderText}>P</Text>
                <Text style={styles.standingsHeaderText}>W</Text>
                <Text style={styles.standingsHeaderText}>D</Text>
                <Text style={styles.standingsHeaderText}>L</Text>
                <Text style={styles.standingsHeaderText}>GD</Text>
                <Text style={styles.standingsHeaderText}>Pts</Text>
              </View>
              
              {standings.map((team, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.standingsRow,
                    index % 2 === 0 && styles.standingsRowEven,
                    team.position <= 4 && styles.standingsRowTop,
                  ]}
                >
                  <Text style={styles.standingsCell}>{team.position}</Text>
                  <Text style={[styles.standingsCell, styles.teamNameCell]} numberOfLines={1} ellipsizeMode="tail">
                    {cleanTeamName(team.team?.name) || 'Team'}
                  </Text>
                  <Text style={styles.standingsCell}>{team.playedGames || 0}</Text>
                  <Text style={styles.standingsCell}>{team.won || 0}</Text>
                  <Text style={styles.standingsCell}>{team.draw || 0}</Text>
                  <Text style={styles.standingsCell}>{team.lost || 0}</Text>
                  <Text style={styles.standingsCell}>{team.goalDifference || 0}</Text>
                  <Text style={[styles.standingsCell, styles.pointsCell]}>
                    {team.points || 0}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#1a1f3a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2f4a',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#95a5a6',
    marginTop: 4,
  },
  leagueSelector: {
    backgroundColor: '#1a1f3a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2f4a',
    maxHeight: 45,
  },
  leagueSelectorContent: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  leagueButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 18,
    backgroundColor: '#2a2f4a',
    marginHorizontal: 5,
    minHeight: 30,
    justifyContent: 'center',
  },
  leagueButtonActive: {
    backgroundColor: '#3498db',
  },
  leagueButtonText: {
    color: '#95a5a6',
    fontSize: 12,
    fontWeight: '600',
  },
  leagueButtonTextActive: {
    color: '#ffffff',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1f3a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2f4a',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3498db',
  },
  tabText: {
    color: '#95a5a6',
    fontSize: 16,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#95a5a6',
    marginTop: 10,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  matchesContainer: {
    padding: 15,
  },
  matchCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2f4a',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchDate: {
    color: '#95a5a6',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  matchContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  score: {
    color: '#3498db',
    fontSize: 24,
    fontWeight: 'bold',
  },
  vsContainer: {
    paddingHorizontal: 15,
  },
  vs: {
    color: '#95a5a6',
    fontSize: 12,
  },
  standingsContainer: {
    padding: 12,
  },
  standingsHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1f3a',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
    alignItems: 'center',
  },
  standingsHeaderText: {
    color: '#95a5a6',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 28,
  },
  teamHeaderText: {
    flex: 1,
    textAlign: 'left',
    paddingLeft: 8,
    minWidth: 100,
  },
  standingsRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2f4a',
  },
  standingsRowEven: {
    backgroundColor: '#15192a',
  },
  standingsRowTop: {
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  standingsCell: {
    color: '#ffffff',
    fontSize: 12,
    textAlign: 'center',
    minWidth: 28,
  },
  teamNameCell: {
    flex: 1,
    textAlign: 'left',
    fontWeight: '600',
    paddingLeft: 8,
    paddingRight: 4,
    fontSize: 12,
  },
  pointsCell: {
    fontWeight: 'bold',
    color: '#3498db',
  },
});

export default App;

