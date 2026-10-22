import { Component } from 'react';
import { ErrorState } from './ui';
import { isChunkLoadError, reloadForNewVersion } from '../utils/chunkReload';

// Last line of defence: instead of a blank page, show a screen with a reload
// button. A missing file from an old deploy reloads straight away.
export class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) reloadForNewVersion();
    else console.error(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const outdated = isChunkLoadError(error);
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
        <ErrorState
          title={outdated ? 'Hay una nueva versión' : 'Algo salió mal'}
          description={outdated
            ? 'La intranet se ha actualizado. Recarga la página para continuar.'
            : 'Ocurrió un error inesperado. Recarga la página para continuar.'}
          action={() => window.location.reload()}
          actionText="Recargar"
        />
      </main>
    );
  }
}
