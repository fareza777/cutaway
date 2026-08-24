/**
 * The quiz.
 *
 * Two question shapes, deliberately: multiple choice tests recall, but "tap the
 * part that does X" tests whether the user can actually find it on the object —
 * which is the thing a 3D app can ask and a flashcard cannot.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { getDoc, getModelAsset } from '@/content/registry';
import type { CutawayViewer } from '@/engine/CutawayViewer';
import type { Question } from '@/content/types';
import { useProgress } from '@/state/progress';
import { GhostButton, Label, PrimaryButton, Text, Touchable } from '@/ui/primitives';
import { Viewport } from '@/ui/Viewport';
import { IconButton } from '@/ui/explorer/TopBar';
import { useColors, useLocale, useT } from '@/state/settings';
import { alpha, radius, space } from '@/ui/theme';
import { showInterstitialIfAllowed } from '@/monetization/ads';

type Feedback = { correct: boolean; message: string } | null;

export default function Quiz() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const recordQuiz = useProgress((state) => state.recordQuiz);
  const locale = useLocale();
  const t = useT();

  const doc = useMemo(() => (id ? getDoc(id, locale) : undefined), [id, locale]);
  const modelAsset = useMemo(() => (id ? getModelAsset(id) : undefined), [id]);

  const viewerRef = useRef<CutawayViewer | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [finished, setFinished] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const interstitialShownForResult = useRef(false);

  const questions = doc?.quiz ?? [];
  const question: Question | undefined = questions[index];
  const accent = doc?.accent ?? colors.text;

  const onReady = useCallback(
    (viewer: CutawayViewer) => {
      viewerRef.current = viewer;
      if (!doc || modelAsset === undefined) return;
      viewer
        .setObject(doc, modelAsset)
        .then(() => {
          viewer.setQuizMode(true);
          viewer.setAutoRotate(false);
        })
        .catch((cause: unknown) => setLoadError(cause instanceof Error ? cause.message : 'Could not load this model.'));
    },
    [doc, modelAsset],
  );

  // Only an "identify" question wants dots on screen; a multiple-choice one
  // would be giving the answer away.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.setHotspotsVisible(question?.type === 'identify');
  }, [question]);

  const advance = useCallback(() => {
    setFeedback(null);
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((current) => current + 1);
  }, [index, questions.length]);

  const answerIdentify = useCallback(
    (partId: string | null) => {
      if (!doc || feedback || !question || question.type !== 'identify') return;
      const correct = partId === question.partId;
      if (correct) setScore((current) => current + 1);
      if (partId) viewerRef.current?.flash(partId, correct);
      if (!correct) viewerRef.current?.flash(question.partId, true);

      const name = doc.parts.find((part) => part.id === question.partId)?.name ?? '';
      setFeedback({
        correct,
        message: correct ? t('quiz.correct') : `${t('quiz.notQuite')} ${name}.`,
      });
    },
    [doc, feedback, question],
  );

  const events = useMemo(() => ({ onAnswer: answerIdentify }), [answerIdentify]);

  const answerChoice = (choice: number) => {
    if (!question || question.type !== 'choice' || feedback) return;
    const correct = choice === question.answer;
    if (correct) setScore((current) => current + 1);
    setFeedback({ correct, message: question.explain ?? (correct ? t('quiz.correct') : t('quiz.notQuite')) });
  };

  useEffect(() => {
    if (finished && doc) recordQuiz(doc.id, { correct: score, total: questions.length });
  }, [finished, doc, recordQuiz, score, questions.length]);

  useEffect(() => {
    if (!finished || !doc || interstitialShownForResult.current) return;
    interstitialShownForResult.current = true;
    const timeout = setTimeout(() => {
      void showInterstitialIfAllowed();
    }, 450);
    return () => clearTimeout(timeout);
  }, [finished, doc]);

  const restart = () => {
    setIndex(0);
    setScore(0);
    setFeedback(null);
    setFinished(false);
    interstitialShownForResult.current = false;
    viewerRef.current?.setQuizMode(true);
  };

  if (!doc || !questions.length || loadError) {
    return (
      <View style={[styles.screen, styles.centre, { backgroundColor: colors.bg }]}>
        <Text variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>
          {loadError ?? t('quiz.none')}
        </Text>
        <GhostButton label={t('common.goBack')} onPress={() => router.back()} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Viewport events={events} onReady={onReady} interactive={!finished} />

      <View style={[styles.header, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <IconButton icon="close" onPress={() => router.back()} accent={accent} label={t('quiz.leave')} />
        <View style={styles.progress}>
          {questions.map((_question, position) => (
            <View
              key={position}
              style={[
                styles.pip,
                {
                  backgroundColor: position < index ? accent : position === index ? alpha(accent, 0.55) : colors.surfacePressed,
                },
              ]}
            />
          ))}
        </View>
        <View style={{ width: 38 }} />
      </View>

      {finished ? (
        <Results
          accent={accent}
          score={score}
          total={questions.length}
          onRetry={restart}
          onDone={() => router.back()}
          bottom={insets.bottom}
          t={t}
        />
      ) : (
        <View style={[styles.panel, { paddingBottom: insets.bottom + space.lg, backgroundColor: colors.scrim, borderColor: colors.hairline }]}>
          <Label color={alpha(accent, 0.9)}>
            {t('quiz.question', { index: index + 1, total: questions.length })}
          </Label>
          <Text variant="title" style={{ marginTop: space.sm }}>
            {question?.prompt}
          </Text>

          {question?.type === 'choice' ? (
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              {question.choices.map((choice, position) => {
                const isAnswer = position === question.answer;
                const chosenWrong = feedback && !feedback.correct && !isAnswer;
                const highlight = feedback ? (isAnswer ? colors.correct : chosenWrong ? colors.hairline : colors.hairline) : colors.hairline;
                return (
                  <Touchable
                    key={choice}
                    onPress={() => answerChoice(position)}
                    disabled={Boolean(feedback)}
                    accessibilityRole="button"
                    style={[
                      styles.choice,
                      {
                        borderColor: highlight,
                        backgroundColor: feedback && isAnswer ? alpha(colors.correct, 0.12) : colors.surface,
                      },
                    ]}
                  >
                    <Text variant="body" color={feedback && isAnswer ? colors.correct : colors.text}>
                      {choice}
                    </Text>
                  </Touchable>
                );
              })}
            </View>
          ) : (
            <Text variant="caption" color={colors.textFaint} style={{ marginTop: space.sm }}>
              {t('quiz.tapHint')}
            </Text>
          )}

          {feedback ? (
            <Animated.View
              entering={FadeInDown.duration(200)}
              exiting={FadeOut}
              style={[
                styles.feedback,
                {
                  borderColor: alpha(feedback.correct ? colors.correct : colors.wrong, 0.4),
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Ionicons
                name={feedback.correct ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={feedback.correct ? colors.correct : colors.wrong}
              />
              <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
                {feedback.message}
              </Text>
            </Animated.View>
          ) : null}

          {feedback ? (
            <PrimaryButton
              label={index + 1 >= questions.length ? t('quiz.seeResult') : t('quiz.next')}
              accent={accent}
              onPress={advance}
              style={{ marginTop: space.md }}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function Results({
  accent,
  score,
  total,
  onRetry,
  onDone,
  bottom,
  t,
}: {
  accent: string;
  score: number;
  total: number;
  onRetry: () => void;
  onDone: () => void;
  bottom: number;
  t: ReturnType<typeof useT>;
}) {
  const colors = useColors();
  const perfect = score === total;
  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      style={[styles.results, { paddingBottom: bottom + space.xl, backgroundColor: colors.scrim }]}
    >
      <ScrollView contentContainerStyle={styles.resultsBody} showsVerticalScrollIndicator={false}>
        <Ionicons
          name={perfect ? 'trophy' : 'ribbon-outline'}
          size={40}
          color={perfect ? colors.correct : accent}
        />
        <Text variant="display" style={{ marginTop: space.lg }}>
          {score} / {total}
        </Text>
        <Text variant="body" color={colors.textMuted} style={{ textAlign: 'center', marginTop: space.sm }}>
          {perfect ? t('quiz.perfect') : score >= total / 2 ? t('quiz.good') : t('quiz.poor')}
        </Text>
        <View style={styles.resultsActions}>
          <GhostButton label={t('quiz.tryAgain')} onPress={onRetry} style={{ flex: 1 }} />
          <PrimaryButton label={t('quiz.done')} accent={accent} onPress={onDone} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  progress: { flex: 1, flexDirection: 'row', gap: 4 },
  pip: { flex: 1, height: 3, borderRadius: 2 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  choice: {
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  results: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
  resultsBody: { alignItems: 'center', padding: space.xxl, flexGrow: 1, justifyContent: 'center' },
  resultsActions: { flexDirection: 'row', gap: space.md, marginTop: space.xxl, alignSelf: 'stretch' },
});
