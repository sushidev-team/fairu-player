import { useLabels } from '@/context/LabelsContext';
import { PlayButton } from '@/components/controls/PlayButton';
import { VolumeControl } from '@/components/controls/VolumeControl';
import { TimeDisplay } from '@/components/controls/TimeDisplay';
import { SkipButton } from '@/components/controls/SkipButtons';
import { CastButton } from '@/components/controls/CastButton';
import { PictureInPictureButton } from '@/components/controls/PictureInPictureButton';
import type { VideoControlsProps } from './VideoControls';

type Props = VideoControlsProps & {
  settingsOpen: boolean;
  onSettingsToggle: () => void;
  menuId: string;
  menuHeight: number;
};

/** Native pickers avoid dropdowns being clipped by a short, embedded video. */
export function CompactVideoControls({
  state, controls, features = {}, disabled = false, subtitles = [],
  playlistState, playlistControls, onFullscreenClick, onQualityChange,
  settingsOpen, onSettingsToggle, menuId, menuHeight,
}: Props) {
  const labels = useLabels();
  const settingsLabel = labels.playerSettings ?? 'Player settings';
  const hasPlaylist = Boolean(playlistState && playlistState.tracks.length > 1 && playlistControls);
  const hasSettings = hasPlaylist || (features.skipButtons !== false && !features.seekingDisabled)
    || features.volumeControl !== false || features.playbackSpeed !== false
    || (features.qualitySelector !== false && state.availableQualities.length > 1)
    || (features.subtitles !== false && subtitles.length > 0)
    || features.pictureInPicture || features.cast;

  return (
    <>
      <div className="fp-video-compact-row">
        <PlayButton size="sm" isPlaying={state.isPlaying} isLoading={state.isLoading} disabled={disabled} onClick={controls.toggle} />
        {features.timeDisplay !== false && <TimeDisplay currentTime={state.currentTime} duration={state.duration} className="fp-video-time" />}
        <div className="flex-1" />
        {features.volumeControl !== false && (
          <VolumeControl className="fp-video-mute" volume={state.volume} muted={state.isMuted} orientation="horizontal"
            onVolumeChange={controls.setVolume} onMuteToggle={controls.toggleMute} />
        )}
        {hasSettings && <button type="button" className="fp-button" aria-label={settingsLabel}
          aria-expanded={settingsOpen} aria-controls={menuId} onClick={onSettingsToggle}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>}
        {features.fullscreen !== false && <button type="button" className="fp-button" disabled={disabled}
          aria-label={state.isFullscreen ? labels.exitFullscreen : labels.enterFullscreen}
          onClick={onFullscreenClick ?? controls.toggleFullscreen}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>}
      </div>
      {settingsOpen && hasSettings && <div id={menuId} role="group" aria-label={settingsLabel}
        className="fp-video-settings" style={{ maxHeight: menuHeight }}>
        {hasPlaylist && playlistState && playlistControls && <div className="fp-video-settings-row">
          <button type="button" className="fp-button" disabled={disabled || playlistState.currentIndex === 0}
            onClick={playlistControls.previous}>{labels.previousTrack}</button>
          <button type="button" className="fp-button" disabled={disabled || playlistState.currentIndex === playlistState.tracks.length - 1}
            onClick={playlistControls.next}>{labels.nextTrack}</button>
        </div>}
        {features.skipButtons !== false && !features.seekingDisabled && <div className="fp-video-settings-row">
          <SkipButton direction="backward" disabled={disabled} onClick={() => controls.skipBackward()} />
          <SkipButton direction="forward" disabled={disabled} onClick={() => controls.skipForward()} />
        </div>}
        {features.volumeControl !== false && <div className="fp-video-settings-row">
          <span>{labels.volume}</span>
          <VolumeControl volume={state.volume} muted={state.isMuted} orientation="horizontal"
            onVolumeChange={controls.setVolume} onMuteToggle={controls.toggleMute} />
        </div>}
        {features.playbackSpeed !== false && <label className="fp-video-settings-row">
          <span>{labels.playbackSpeed}</span>
          <select aria-label={labels.playbackSpeed} value={state.playbackRate} disabled={disabled}
            onChange={event => controls.setPlaybackRate(Number(event.target.value))}>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => <option key={speed} value={speed}>{speed}x</option>)}
          </select>
        </label>}
        {features.qualitySelector !== false && state.availableQualities.length > 1 && <label className="fp-video-settings-row">
          <span>{labels.selectQuality}</span>
          <select aria-label={labels.selectQuality} value={state.currentQuality} disabled={disabled}
            onChange={event => (onQualityChange ?? controls.setQuality)(event.target.value)}>
            {!state.availableQualities.some(quality => quality.label === state.currentQuality)
              && <option value={state.currentQuality}>{state.currentQuality}</option>}
            {state.availableQualities.map(quality => <option key={quality.label} value={quality.label}>{quality.label}</option>)}
          </select>
        </label>}
        {features.subtitles !== false && subtitles.length > 0 && <label className="fp-video-settings-row">
          <span>{labels.subtitles}</span>
          <select aria-label={labels.subtitles} value={state.currentSubtitle ?? ''} disabled={disabled}
            onChange={event => controls.setSubtitle(event.target.value || null)}>
            <option value="">{labels.subtitlesOff}</option>
            {subtitles.map(subtitle => <option key={subtitle.id} value={subtitle.id}>{subtitle.label}</option>)}
          </select>
        </label>}
        {(features.pictureInPicture || features.cast) && <div className="fp-video-settings-row">
          {features.pictureInPicture && <PictureInPictureButton isPictureInPicture={state.isPictureInPicture} disabled={disabled} onClick={controls.togglePictureInPicture} />}
          {features.cast && <CastButton isCasting={state.isCasting} disabled={disabled} onClick={controls.toggleCast} />}
        </div>}
      </div>}
    </>
  );
}
